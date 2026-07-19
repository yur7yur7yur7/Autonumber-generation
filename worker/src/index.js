// ============================================
// Cloudflare Worker — Telegram relay
// ============================================
//
// Receives POST {svg, filename, number, region, front_png, back_png, png, order_*}
// from the editor's "Отправить на печать" button and forwards, per chat in
// TG_CHAT_IDS:
//   1. a media group of 1–2 PNG previews (front, optionally back) with a
//      MarkdownV2 caption that lists number, region, date, and order info;
//   2. the ready-to-print PNG (or fallback SVG) as a separate sendDocument.
//
// Secrets (set via `wrangler secret put` or Cloudflare dashboard, NEVER in code):
//   TG_BOT_TOKEN  — token from @BotFather
//   TG_CHAT_IDS   — comma-separated destination chat ids, e.g. "111,222"
//
// Request body (JSON):
//   {
//     "svg":           "<svg ...>...</svg>",
//     "png":           "data:image/png;base64,..."   // optional, готовый PNG
//     "filename":      "brelok-M789MM21.png",
//     "number":        "M789MM",                     // optional, в caption
//     "region":        "21",                         // optional, в caption
//     "front_png":     "data:image/png;base64,..."   // optional, превью
//     "back_png":      "data:image/png;base64,..."   // optional, превью
//     "config":        "{...}"                       // optional, конфиг брелка
//                                                      из js/brelok-config.js;
//                                                      если есть — отправляется
//                                                      вторым sendDocument с
//                                                      именем `<file>.config.json`.
//     "order_name":    "Иван",                       // optional, форма заказа
//     "order_contact": "@dukas",                     // optional, форма заказа
//     "order_comment": "Хочу шрифт покрупнее"        // optional, форма заказа
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
            // GET /api/config?id=<uuid> — отдаёт .brelok-config.json из KV,
            // чтобы back.html мог достать его без sessionStorage. Остальные
            // GET/HEAD/PUT и пр. — Method Not Allowed.
            const url = new URL(request.url);
            if (request.method === 'GET' && url.pathname === '/api/config') {
                return handleApiConfigGet(request, env, url);
            }
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
        const caption = buildCaption({
            number,
            region,
            hasBack: !!parseDataUrl(body && body.back_png),
            order: {
                name: String((body && body.order_name) || '').trim(),
                contact: String((body && body.order_contact) || '').trim(),
                comment: String((body && body.order_comment) || '').trim(),
            },
        });

        const frontPng = parseDataUrl(body && body.front_png);
        const backPng = parseDataUrl(body && body.back_png);
        // Опциональный готовый PNG-макет целиком (front+back одной картинкой).
        // Если есть — отправим его как sendDocument с image/png вместо SVG.
        // Валидация svg выше остаётся как fallback для старых клиентов.
        const readyPng = parseDataUrl(body && body.png);
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
        // Что отправлять как sendDocument: готовый PNG-макет (если есть) или
        // SVG как fallback. Расширение файла должно соответствовать MIME —
        // иначе Telegram сохранит его с правильным MIME, но имя в *.svg / *.png
        // врёт, и файл не открывается как ожидаемый формат.
        let docBytes, docMime, docFilename;
        if (readyPng) {
            docBytes = readyPng;
            docMime = 'image/png';
            // Если пришло имя с .svg — переименуем в .png, иначе оставим.
            docFilename = filenameSafe.replace(/\.svg$/i, '.png');
        } else {
            docBytes = new TextEncoder().encode(svg);
            docMime = 'image/svg+xml';
            docFilename = filenameSafe;
        }

        // Fan out to every chat in TG_CHAT_IDS. Per recipient we do:
        //   1. sendMediaGroup with 1–2 photos + caption (one HTTP call to Telegram)
        //   2. sendDocument with the SVG file (или PNG, если есть в payload)
        //   3. sendDocument с config-файлом — только если в payload есть body.config
        //      (прислано из js/brelok-config.js через sendMaketToTelegram).
        //      После успешной отправки дополнительно шлём sendMessage c inline-
        //      кнопкой «🔧 Открыть на сайте», ссылающейся на KV-UUID конфига.
        //      UUID генерируется один раз на все чаты, чтобы ссылка была
        //      идентичной для всех получателей. KV пишется один раз (вне цикла).
        // Sequential, with a 1.1s gap between recipients — Telegram's
        // 1 msg/s/chat flood control. For 2 recipients this is ~2.2s total,
        // acceptable for an operator-facing UX.

        // Сгенерируем UUID и положим конфиг в KV — один раз для всех чатов,
        // если конфиг вообще есть. Без KV (BRELOK_CONFIG не бинден) — отдаём
        // только sendDocument, без inline-кнопки.
        let configUuid = null;
        if (body.config && typeof body.config === 'string' && body.config.trim() && env.BRELOK_CONFIG) {
            try {
                configUuid = crypto.randomUUID();
                // metadata: schemaVersion + тип — для будущей миграции / cleanup.
                await env.BRELOK_CONFIG.put(configUuid, body.config, {
                    metadata: {
                        brelokType: 'ru',
                        uploadedAt: new Date().toISOString(),
                    },
                });
            } catch (e) {
                console.warn('KV put failed, кнопка в Telegram не будет:', e && e.message);
                configUuid = null;
            }
        }

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

            // 2) Document — PNG (если есть в payload) или SVG (fallback). MIME/имя
            //    согласованы, чтобы Telegram правильно показывал превью и
            //    сохранял файл с корректным расширением.
            const docBoundary = '----BrelokBoundary' + crypto.randomUUID().replace(/-/g, '');
            const docMultipart = buildDocumentMultipart(
                docBoundary, chatId, docBytes, docFilename, docMime
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

            // 3) Config — второй sendDocument, только если в payload есть
            //    строка `config` (прислана из js/brelok-config.js). Имя файла
            //    привязано к номеру/региону, чтобы оператору было понятно,
            //    к какому макету относится этот JSON. Не валим весь результат
            //    из-за ошибки отправки config (он — справочный документ).
            if (body.config && typeof body.config === 'string' && body.config.trim()) {
                const cfgName = `brelok-${(String(body.number || '').trim())}${(String(body.region || '').trim())}.config.json`
                    .replace(/brelok-\.config\.json$/, 'brelok.config.json');
                const cfgBytes = new TextEncoder().encode(body.config);
                const cfgBoundary = '----BrelokCfgBoundary' + crypto.randomUUID().replace(/-/g, '');
                const cfgMultipart = buildDocumentMultipart(
                    cfgBoundary, chatId, cfgBytes, cfgName, 'application/json'
                );
                const cfgResp = await fetch(
                    'https://api.telegram.org/bot' + botToken + '/sendDocument',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'multipart/form-data; boundary=' + cfgBoundary },
                        body: cfgMultipart,
                    }
                );
                const cfgJson = await cfgResp.json().catch(() => null);
                if (!cfgResp.ok || !cfgJson || !cfgJson.ok) {
                    chatResult.config_document = {
                        ok: false,
                        error: (cfgJson && cfgJson.description) || ('HTTP ' + cfgResp.status),
                    };
                    console.warn('config sendDocument failed for', chatId, cfgJson && cfgJson.description);
                } else {
                    const cmsg = cfgJson.result;
                    chatResult.config_document = {
                        ok: true,
                        message_id: cmsg && cmsg.message_id,
                        file_id: cmsg && cmsg.document && cmsg.document.file_id,
                    };

                    // 3a) Inline-кнопка «Открыть на сайте» в ответ на каждый
                    //     конфиг. URL собирается из SITE_BASE_URL + UUID, по
                    //     которому back.html через GET /api/config?id=<uuid>
                    //     вытянет этот же JSON из KV. Один UUID на все чаты —
                    //     внутри чатов ссылка общая.
                    if (configUuid) {
                        const buttonText = '🔧 Открыть на сайте';
                        const buttonUrl = buildOpenUrl(env, configUuid);
                        const btnResp = await fetch(
                            'https://api.telegram.org/bot' + botToken + '/sendMessage',
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    chat_id: chatId,
                                    text: '⬆️ Откройте макет в редакторе, нажмите кнопку ниже:',
                                    reply_markup: {
                                        inline_keyboard: [[
                                            { text: buttonText, url: buttonUrl },
                                        ]],
                                    },
                                }),
                            }
                        );
                        const btnJson = await btnResp.json().catch(() => null);
                        if (!btnResp.ok || !btnJson || !btnJson.ok) {
                            chatResult.config_button = {
                                ok: false,
                                error: (btnJson && btnJson.description) || ('HTTP ' + btnResp.status),
                            };
                            console.warn('config sendMessage(button) failed for', chatId, btnJson && btnJson.description);
                        } else {
                            chatResult.config_button = {
                                ok: true,
                                message_id: btnJson.result && btnJson.result.message_id,
                            };
                        }
                    }
                }
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
// document (bytes with given MIME). No caption — Telegram shows it as a
// bare document after the media-group message above. MIME берётся из
// вызывающего кода: image/svg+xml (fallback) или image/png (готовый макет).
function buildDocumentMultipart(boundary, chatId, fileBytes, filename, mime) {
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
        'Content-Type: ' + mime + '\r\n' +
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
function buildCaption({ number, region, hasBack, order }) {
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
    // Блок данных заказа — добавляем, если есть хотя бы одно непустое поле.
    // Имя и контакт показываем всегда при наличии; комментарий — отдельным
    // блоком, чтобы оператор сразу видел пожелания.
    const o = order || {};
    if (o.name || o.contact || o.comment) {
        lines.push('', '*👤 Заказ*');
        if (o.name) {
            lines.push('*Имя:* ' + escapeMarkdownV2(o.name));
        }
        if (o.contact) {
            lines.push('*Контакт:* `' + escapeMarkdownV2(o.contact) + '`');
        }
        if (o.comment) {
            // Цитируем многострочный комментарий построчно — Telegram MarkdownV2
            // поддерживает \` внутри ```-блоков, но безопаснее экранировать
            // каждую строку отдельно и не делать code-блок (в нём переводы
            // строк не выводятся).
            lines.push('*Комментарий:*');
            const commentLines = String(o.comment).split(/\r?\n/);
            for (const cl of commentLines) {
                lines.push('_' + escapeMarkdownV2(cl) + '_');
            }
        }
    }
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
            // Worker runtime на Cloudflare живёт в UTC; без явного timeZone
            // дата в подписи уезжала на -3 часа. Europe/Moscow — постоянный
            // UTC+3 (без сезонного перевода стрелок с 2014).
            timeZone: 'Europe/Moscow',
        });
    } catch (e) {
        // toLocaleString may fail in some Workers runtimes if ICU data is
        // missing — fall back to ISO with explicit +03:00 so the operator
        // never reads a UTC stamp and mistakes it for local time.
        const iso = d.toISOString();
        return iso.replace('Z', '+03:00');
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

/**
 * GET /api/config?id=<uuid> — отдаёт .brelok-config.json из KV.
 *
 * KV-binding BRELOK_CONFIG должен быть привязан (см. worker/wrangler.toml).
 * Если binding отсутствует или конфиг не найден — 404.
 *
 * Для inline-кнопки в Telegram использовался UUID, сгенерированный в fan-out
 * цикле запроса / и сохранённый в KV под ключом = UUID. Никакой авторизации
 * не требуется: UUID — это секрет в URL, и подобрать 122-битный идентификатор
 * нереально (как сбрутфорсить uuid4).
 *
 * @param {Request} request
 * @param {Object} env
 * @param {URL} url
 * @returns {Promise<Response>}
 */
async function handleApiConfigGet(request, env, url) {
    const cors = corsHeaders();
    // CORS — сайт на github.io, воркер на workers.dev, Access-Control-Origin
    // уже выставлен на '*'. Этого достаточно: GET без credentials.
    if (!env.BRELOK_CONFIG) {
        return jsonResponse({ ok: false, error: 'KV not bound' }, 500, cors);
    }
    const id = url.searchParams.get('id');
    if (!id || !/^[0-9a-fA-F-]{8,64}$/.test(id)) {
        return jsonResponse({ ok: false, error: 'Missing or malformed id' }, 400, cors);
    }
    let value;
    try {
        value = await env.BRELOK_CONFIG.get(id);
    } catch (e) {
        return jsonResponse({ ok: false, error: 'KV read failed: ' + (e && e.message) }, 500, cors);
    }
    if (!value) {
        return jsonResponse({ ok: false, error: 'Config not found' }, 404, cors);
    }
    // Отдаём напрямую как application/json — back.html ждёт JSON, а не строку,
    // которую сам бы парсил. CORS-headers обязательны: см. note выше.
    return new Response(value, {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...cors,
        },
    });
}

/**
 * Собрать абсолютный URL сайта для inline-кнопки. Берёт SITE_BASE_URL из
 * env (vars в wrangler.toml или secret), при отсутствии — fallback.
 * Возвращает строку БЕЗ trailing slash; добавляет '/back.html?config=…'.
 */
function buildOpenUrl(env, uuid) {
    const base = (env.SITE_BASE_URL || 'https://yur7yur7yur7.github.io/Autonumber-generation')
        .replace(/\/$/, '');
    return base + '/back.html?config=' + encodeURIComponent(uuid) + '&type=ru';
}
