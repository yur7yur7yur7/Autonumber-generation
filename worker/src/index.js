// ============================================
// Cloudflare Worker — Telegram sendDocument relay
// ============================================
//
// Receives POST {svg, filename} from the editor's "Скачать макет" button
// and forwards the SVG to a fixed Telegram chat via the BrelokGenerationBot.
//
// Secrets (set via `wrangler secret put` or Cloudflare dashboard, NEVER in code):
//   TG_BOT_TOKEN  — token from @BotFather
//   TG_CHAT_ID    — destination chat id (numeric string)
//
// Request body (JSON):
//   { "svg": "<svg ...>...</svg>", "filename": "brelok-XXX-YYY.svg" }
//
// Response:
//   200 { "ok": true, "message_id": 123, "file_id": "..." }
//   400 { "ok": false, "error": "..." }    — bad input
//   502 { "ok": false, "error": "..." }    — upstream Telegram error
//   500 { "ok": false, "error": "..." }    — internal error

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
        const chatId = env.TG_CHAT_ID;
        if (!botToken || !chatId) {
            return jsonResponse({
                ok: false,
                error: 'Worker misconfigured: TG_BOT_TOKEN and/or TG_CHAT_ID missing',
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

        // Build multipart/form-data for sendDocument.
        const boundary = '----BrelokBoundary' + crypto.randomUUID().replace(/-/g, '');
        const fileBytes = new TextEncoder().encode(svg);
        const filenameSafe = filename.replace(/[\r\n"]/g, '_').slice(0, 200);
        const caption = 'Новый макет из генератора (' + new Date().toISOString() + ')';
        const multipart = buildMultipart(boundary, chatId, fileBytes, filenameSafe, caption);

        const apiResp = await fetch(
            'https://api.telegram.org/bot' + botToken + '/sendDocument',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data; boundary=' + boundary,
                },
                body: multipart,
            }
        );
        const apiResult = await apiResp.json().catch(() => null);
        if (!apiResp.ok || !apiResult || !apiResult.ok) {
            const desc = (apiResult && apiResult.description) || ('HTTP ' + apiResp.status);
            return jsonResponse({ ok: false, error: 'Telegram: ' + desc }, 502);
        }
        const msg = apiResult.result;
        return jsonResponse({
            ok: true,
            message_id: msg && msg.message_id,
            file_id: msg && msg.document && msg.document.file_id,
        });
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

// Build a multipart/form-data body as a Uint8Array. We assemble it by hand
// (no FormData shim) so we have precise control over the boundary and the
// content-disposition per part.
function buildMultipart(boundary, chatId, fileBytes, filename, caption) {
    const enc = new TextEncoder();
    const parts = [];

    // Part 1: chat_id (text field).
    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="chat_id"\r\n' +
        '\r\n' +
        chatId + '\r\n'
    ));

    // Part 2: document (binary file).
    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="document"; filename="' + filename + '"\r\n' +
        'Content-Type: image/svg+xml\r\n' +
        '\r\n'
    ));
    parts.push(fileBytes);
    parts.push(enc.encode('\r\n'));

    // Part 3: caption (text field, optional but useful for the operator).
    parts.push(enc.encode(
        '--' + boundary + '\r\n' +
        'Content-Disposition: form-data; name="caption"\r\n' +
        '\r\n' +
        caption + '\r\n'
    ));

    // Closing boundary.
    parts.push(enc.encode('--' + boundary + '--\r\n'));

    // Concatenate all parts. Total size should match headers automatically
    // because multipart boundaries are byte-exact.
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
