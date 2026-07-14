// ============================================
// Cloudflare Worker — Telegram relay
// ============================================
//
// Receives POST {svg, filename, number, region, front_png, back_png} from the
// editor's "Скачать макет" button and forwards, per chat in TG_CHAT_IDS:
//   1. a media group of 1–2 PNG previews (front, optionally back) with a
//      MarkdownV2 caption that lists number, region, and a human-readable date;
//   2. the SVG file as a separate sendDocument message.
//
// Secrets (set via `wrangler secret put` or Cloudflare dashboard, NEVER in code):
//   TG_BOT_TOKEN  — token from @BotFather
//   TG_CHAT_IDS   — comma-separated destination chat ids, e.g. "111,222"
//
// Request body (JSON):
//   {
//     "svg":       "<svg ...>...</svg>",
//     "filename":  "brelok-M789MM21.svg",
//     "number":    "M789MM",         // optional, used in caption
//     "region":    "21",             // optional, used in caption
//     "front_png": "data:image/png;base64,iVBORw0...",  // optional
//     "back_png":  "data:image/png;base64,iVBORw0..."   // optional
//   }
//
// Response:
//   200 { "ok": true, "results": [{ "chat_id": "111", "ok": true, "media": [...], "document": {...} }, ...] }
//   400 { "ok": false, "error": "..." }    — bad input
//   413 { "ok": false, "error": "..." }    — SVG too large (>20 MB)
//   502 { "ok": false, "error": "...", "results": [...] }
//                                    — upstream Telegram error for at least one recipient
//   500 { "ok": false, "error": "..." }    — internal error / misconfig

export default {
    async fetch(request, env) {
        // CORS preflight — the editor is served from a different origin
        // (e.g. github.io) than the worker (e.g. *.workers.dev).
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(),
            });
        }

        if (request.method !== 'POST') {
            return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
        }

        // Validate env at runtime — fail fast with a clear message if missing.
        const botToken = env.TG_BOT_TOKEN;
        const chatIdsRaw = env.TG_CHAT_IDS;
        if (!botToken || !chatIdsRaw) {
            return jsonResponse({
                ok: false,
                error: 'Worker misconfigured: TG_BOT_TOKEN and/or TG_CHAT_IDS missing',
            }, 500);
        }
        // Comma-separated list. Trim, drop empties, keep at most 10 — Telegram's
        // global ~30 msg/s/token is plenty, but a runaway secret shouldn't fan out
        // to thousands of chats.
        const chatIds = String(chatIdsRaw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 10);
        if (chatIds.length === 0) {
            return jsonResponse({
                ok: false,
                error: 'Worker misconfigured: TG_CHAT_IDS is empty',
            }, 500);
        }

        let body;
        try {
            body = await request.json();
        } catch (e) {
            return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }

        const svg = body && body.svg;
        const filename = (body && body.filename) || 'brelok.svg';
        if (typeof svg !== 'string' || svg.length < 10) {
            return jsonResponse({ ok: false, error: 'Missing or empty svg field' }, 400);
        }
        if (svg.length > 20 * 1024 * 1024) {
            // Telegram Bot API 50 MB hard limit; 20 MB is the practical safe ceiling
            // for multipart body + headers.
            return jsonResponse({ ok: false, error: 'SVG too large (>20 MB)' }, 413);
        }

        // Build the human-readable caption in MarkdownV2. Escape every value the user
        // could influence (number, region) so stray '.' or '_' can't break parsing.
        const number = String((body && body.number) || '').trim() || '—';
        const region = String((body && body.region) || '').trim() || '—';
        const caption = buildCaption({ number, region, hasBack: !!parseDataUrl(body && body.back_png) });

        const frontPng = parseDataUrl(body && body.front_png);
        const backPng = parseDataUrl(body && body.back_png);
        const mediaItems = [];
        if (frontPng) {
            mediaItems.push({ kind: 'front', bytes: frontPng });
        }
        if (backPng) {
            mediaItems.push({ kind: 'back', bytes: backPng });
        }
        if (mediaItems.length === 0) {
            return jsonResponse({
                ok: false,
                error: 'No preview images provided (front_png and back_png are both missing or invalid)',
            }, 400);
        }

        const filenameSafe = String(filename).replace(/[\r\n"]/g, '_').slice(0, 200);
        const svgBytes = new TextEncoder().encode(svg);

        // Fan out to every chat in TG_CHAT_IDS. Per recipient we do:
        //   1. sendMediaGroup with 1–2 photos + caption (one HTTP call to Telegram)
        //   2. sendDocument with the SVG file
        // Sequential, with a 1.1s gap between recipients — Telegram's
        // 1 msg/s/chat flood control. For 2 recipients this is ~2.2s total,
        // acceptable for an operator-facing UX.
        const results = [];
        for (let i = 0; i < chatIds.length; i++) {
            const chatId = chatIds[i];
            const chatResult = { chat_id: chatId, ok: true, media: null, document: null };

            // 1) Media group: photos + shared MarkdownV2 caption.
            // Telegram requires that any media entry using `attach://` is sent as
            // multipart/form-data with the referenced files attached by the same
            // name. buildMediaGroupMultipart encodes the JSON body + files in one
            // request so attach:// resolves to real bytes on Telegram's side.
            const mediaMultipart = buildMediaGroupMultipart(chatId, caption, mediaItems);
            const mediaResp = await fetch(
                'https://api.telegram.org/bot' + botToken + '/sendMediaGroup',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'multipart/form-data; boundary=' + mediaMultipart.boundary },
                    body: mediaMultipart.body,
                }
            );
            const mediaJson = await mediaResp.json().catch(() => null);
            if (!mediaResp.ok || !mediaJson || !mediaJson.ok) {
                chatResult.ok = false;
                chatResult.media = {
                    ok: false,
                    error: (mediaJson && mediaJson.description) || ('HTTP ' + mediaResp.status),
                };
                results.push(chatResult);
                if (i < chatIds.length - 1) await new Promise((r) => setTimeout(r, 1100));
                continue;
            }
            chatResult.media = {
                ok: true,
                messages: Array.isArray(mediaJson.result)
                    ? mediaJson.result.map((m) => m && m.message_id).filter(Boolean)
                    : [],
            };

            // 2) SVG document — separate message, no caption.
            const docBoundary = '----BrelokBoundary' + crypto.randomUUID().replace(/-/g, '');
            const docMultipart = buildDocumentMultipart(
                docBoundary, chatId, svgBytes, filenameSafe
            );
            const docResp = await fetch(
                'https://api.telegram.org/bot' + botToken + '/sendDocument',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'multipart/form-data; boundary=' + docBoundary },
                    body: docMultipart,
                }
            );
            const docJson = await docResp.json().catch(() => null);
            if (!docResp.ok || !docJson || !docJson.ok) {
                chatResult.ok = false;
                chatResult.document = {
                    ok: false,
                    error: (docJson && docJson.description) || ('HTTP ' + docResp.status),
                };
            } else {
                const msg = docJson.result;
                chatResult.document = {
                    ok: true,
                    message_id: msg && msg.message_id,
                    file_id: msg && msg.document && msg.document.file_id,
                };
            }

            results.push(chatResult);
            if (i < chatIds.length - 1) {
                await new Promise((r) => setTimeout(r, 1100));
            }
        }

        const allOk = results.every((r) => r.ok);
        if (!allOk) {
            const failed = results
                .filter((r) => !r.ok)
                .map((r) => {
                    const parts = [];
                    if (r.media && !r.media.ok) parts.push('media: ' + r.media.error);
                    if (r.document && !r.document.ok) parts.push('document: ' + r.document.error);
                    return r.chat_id + ' (' + (parts.join('; ') || 'unknown') + ')';
                })
                .join('; ');
            return jsonResponse({ ok: false, error: 'Telegram: ' + failed, results }, 502);
        }
        return jsonResponse({ ok: true, results });
    },
};

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders(),
        },
    });
}

// Build a multipart/form-data body for sendMediaGroup.
//
// Telegram's Bot API expects the following shape (per their docs and source):
//   1. chat_id as its own form-data text part;
//   2. media as its own form-data text part whose body is the JSON array of
//      InputMedia objects (caption + parse_mode live inside each entry, not
//      at the top level — except parse_mode which IS allowed at top level);
//   3. each `attach://<name>` reference resolves to a file part whose
//      Content-Disposition name equals <name> exactly (no extension).
//
// Earlier versions of this function packed everything into one JSON blob
// (or skipped the chat_id part) and Telegram returned HTTP 400 with
// "chat_id: chat not found" / "wrong type" — depending on which field was
// misinterpreted. The shape below is the one accepted by the API.
function buildMediaGroupMultipart(chatId, caption, mediaItems) {
    const boundary = '----BrelokBoundary' + crypto.randomUUID().replace(/-/g, '');
    const enc = new TextEncoder();
    const parts = [];

    // 1) chat_id — text part. Keep it as a string exactly as supplied by the
    // TG_CHAT_IDS secret; Telegram accepts both numeric strings and positive
    // integers but mixing forms across requests is a recipe for confusion.
    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="chat_id"\r\n' +
        '\r\n' +
        chatId + '\r\n'
    ));

    // 2) media — JSON array as a text part.
    const mediaJson = mediaItems.map((m, idx) => {
        const entry = {
            type: 'photo',
            media: 'attach://' + m.kind,
        };
        if (idx === 0) {
            entry.caption = caption;
            entry.parse_mode = 'MarkdownV2';
        }
        return entry;
    });
    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="media"\r\n' +
        'Content-Type: application/json; charset=utf-8\r\n' +
        '\r\n' +
        JSON.stringify(mediaJson) + '\r\n'
    ));

    // 3) Attached files — one part per item, name must match `attach://<name>`.
    for (const m of mediaItems) {
        parts.push(enc.encode(
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data; name="' + m.kind + '"; filename="' + m.kind + '.png"\r\n' +
            'Content-Type: image/png\r\n' +
            '\r\n'
        ));
        parts.push(m.bytes);
        parts.push(enc.encode('\r\n'));
    }

    parts.push(enc.encode('--' + boundary + '--\r\n'));

    let total = 0;
    for (const p of parts) total += p.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.byteLength;
    }
    return { boundary, body: out };
}

// Build a multipart/form-data body for sendDocument. The 3 parts are: chat_id,
// document (SVG bytes, image/svg+xml). No caption — Telegram shows it as a
// bare document after the media-group message above.
function buildDocumentMultipart(boundary, chatId, fileBytes, filename) {
    const enc = new TextEncoder();
    const parts = [];

    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="chat_id"\r\n' +
        '\r\n' +
        chatId + '\r\n'
    ));

    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="document"; filename="' + filename + '"\r\n' +
        'Content-Type: image/svg+xml\r\n' +
        '\r\n'
    ));
    parts.push(fileBytes);
    parts.push(enc.encode('\r\n'));

    parts.push(enc.encode('--' + boundary + '--\r\n'));

    let total = 0;
    for (const p of parts) total += p.byteLength;
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
        out.set(p, off);
        off += p.byteLength;
    }
    return out;
}

// Build the MarkdownV2 caption shown under the first photo in the media group.
function buildCaption({ number, region, hasBack }) {
    const date = formatHumanDate(new Date());
    // Escape every user-controlled piece: Telegram's MarkdownV2 requires that
    // these characters appear only inside `*…*`, `_…_`, etc. — anywhere else
    // they MUST be backslash-escaped or the whole parse fails.
    const n = escapeMarkdownV2(number);
    const r = escapeMarkdownV2(region);
    const d = escapeMarkdownV2(date);
    const lines = [
        '*🪪 Новый макет*',
        '',
        '*Номер:* `' + n + '`',
        '*Регион:* `' + r + '`',
        '*Дата:* ' + d,
    ];
    if (!hasBack) {
        lines.push('', '_Задняя сторона: не приложена_');
    } else {
        lines.push('', '📎 Файл во вложении ниже ↓');
    }
    return lines.join('\n');
}

// Telegram MarkdownV2 reserved characters that must be escaped outside
// formatting constructs.
const MD2_RESERVED = /([_*\[\]()~`>#+\-=|{}.!\\])/g;
function escapeMarkdownV2(s) {
    return String(s).replace(MD2_RESERVED, '\\$1');
}

function formatHumanDate(d) {
    try {
        return d.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        // toLocaleString may fail in some Workers runtimes if ICU data is
        // missing — fall back to ISO so we never emit `undefined`.
        return d.toISOString();
    }
}

// Decode a `data:image/png;base64,...` URL into raw PNG bytes. Returns null if
// the input is missing or not a recognizable PNG data URL.
function parseDataUrl(value) {
    if (typeof value !== 'string') return null;
    const m = value.match(/^data:image\/png;base64,(.+)$/);
    if (!m) return null;
    try {
        const bin = atob(m[1]);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    } catch (e) {
        return null;
    }
}
