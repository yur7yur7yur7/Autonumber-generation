import test from 'node:test';
import assert from 'node:assert/strict';

import worker, {
    buildCaption,
    buildDocumentMultipart,
    buildMediaGroupMultipart,
    buildOpenUrl,
    escapeMarkdownV2,
    neutralizeUrls,
    normalizeConfig,
    parsePngDataUrl,
} from '../src/index.js';

const PNG_SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DATA_URL = 'data:image/png;base64,' + Buffer.from(PNG_SIGNATURE).toString('base64');

test('escapeMarkdownV2 escapes every reserved character', () => {
    const reserved = '_*[]()~`>#+-=|{}.!\\';
    assert.equal(escapeMarkdownV2(reserved), reserved.split('').map((char) => '\\' + char).join(''));
});

test('caption escapes user fields and neutralizes supplied comment URL', () => {
    const caption = buildCaption({
        number: 'A_1',
        region: '77.',
        hasBack: true,
        order: {
            name: 'Иван*',
            contact: '@user',
            comment: neutralizeUrls('Ссылка https://evil.example/a_b'),
        },
    });

    assert.match(caption, /A\\_1/);
    assert.match(caption, /77\\\./);
    assert.match(caption, /Иван\\\*/);
    assert.match(caption, /https\\\[:\\\]\/\/evil\u2024example\/a\\_b/);
    assert.doesNotMatch(caption, /evil\.example/);
});

test('neutralizeUrls swaps only domain dots, leaves normal punctuation', () => {
    assert.equal(neutralizeUrls('example.com'), 'example․com');
    assert.equal(neutralizeUrls('Подключи github.com/foo/bar'), 'Подключи github․com/foo/bar');
    assert.equal(neutralizeUrls('Готово. Спасибо.'), 'Готово. Спасибо.');
    assert.equal(neutralizeUrls('1.5 часа и 3.14'), '1.5 часа и 3.14');
    assert.equal(neutralizeUrls('https://x.io/path?a=1.b'), 'https[:]//x․io/path?a=1.b');
});

test('parsePngDataUrl accepts a PNG signature and rejects invalid bytes', () => {
    assert.deepEqual(parsePngDataUrl(PNG_DATA_URL), PNG_SIGNATURE);
    assert.equal(parsePngDataUrl('data:image/png;base64,' + Buffer.from('not png').toString('base64')), null);
    assert.equal(parsePngDataUrl(PNG_DATA_URL, 7), null);
});

test('normalizeConfig accepts only small JSON objects', () => {
    assert.equal(normalizeConfig('{"version":1}'), '{"version":1}');
    assert.equal(normalizeConfig('[]'), null);
    assert.equal(normalizeConfig('not json'), null);
    assert.equal(normalizeConfig(JSON.stringify({ value: 'x'.repeat(210 * 1024) })), null);
});

test('buildOpenUrl permits both production sites', () => {
    assert.equal(
        buildOpenUrl({ SITE_BASE_URL: 'https://yur7yur7yur7.github.io/Autonumber-generation/' }, 'abc-123'),
        'https://yur7yur7yur7.github.io/Autonumber-generation/back.html?config=abc-123&type=ru'
    );
    assert.equal(
        buildOpenUrl({ SITE_BASE_URL: 'https://autonum.pages.dev/' }, 'abc-123'),
        'https://autonum.pages.dev/back.html?config=abc-123&type=ru'
    );
    assert.throws(
        () => buildOpenUrl({ SITE_BASE_URL: 'https://phishing.example' }, 'abc-123'),
        /not in the allowed site list/
    );
});

test('media multipart keeps attachment names and binary bytes', () => {
    const media = buildMediaGroupMultipart('123', 'caption', [
        { kind: 'front', bytes: PNG_SIGNATURE },
        { kind: 'back', bytes: PNG_SIGNATURE },
    ]);
    const text = Buffer.from(media.body).toString('latin1');

    assert.ok(text.startsWith('--' + media.boundary + '\r\n'));
    assert.match(text, /name="chat_id"\r\n\r\n123\r\n/);
    assert.match(text, /attach:\/\/front/);
    assert.match(text, /attach:\/\/back/);
    assert.match(text, /name="front"; filename="front\.png"/);
    assert.match(text, /name="back"; filename="back\.png"/);
    assert.ok(text.endsWith('--' + media.boundary + '--\r\n'));
    assert.equal(Buffer.from(media.body).includes(Buffer.from(PNG_SIGNATURE)), true);
});

test('document multipart uses provided filename, MIME and closing boundary', () => {
    const boundary = 'test-boundary';
    const body = buildDocumentMultipart(boundary, '123', PNG_SIGNATURE, 'order.png', 'image/png');
    const text = Buffer.from(body).toString('latin1');

    assert.match(text, /name="chat_id"\r\n\r\n123\r\n/);
    assert.match(text, /name="document"; filename="order\.png"/);
    assert.match(text, /Content-Type: image\/png/);
    assert.ok(text.endsWith('--' + boundary + '--\r\n'));
    assert.equal(Buffer.from(body).includes(Buffer.from(PNG_SIGNATURE)), true);
});

test('order route rejects unsupported paths and content types before Telegram', async () => {
    const notFound = await worker.fetch(new Request('https://worker.example/other', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    }), {});
    assert.equal(notFound.status, 404);

    const unsupported = await worker.fetch(new Request('https://worker.example/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}',
    }), {});
    assert.equal(unsupported.status, 415);
});

test('rate limiter returns 429 before reading or forwarding an order', async () => {
    let key = null;
    const response = await worker.fetch(new Request('https://worker.example/api/order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '203.0.113.7',
        },
        body: '{not-json',
    }), {
        ORDER_RATE_LIMITER: {
            async limit(input) {
                key = input.key;
                return { success: false };
            },
        },
    });

    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(key, 'order:203.0.113.7');
});

test('OPTIONS and config GET do not consume order rate limit', async () => {
    let calls = 0;
    const env = {
        ORDER_RATE_LIMITER: { async limit() { calls++; return { success: true }; } },
        BRELOK_CONFIG: { async get() { return '{"version":1}'; } },
    };

    const options = await worker.fetch(new Request('https://worker.example/api/order', { method: 'OPTIONS' }), env);
    const config = await worker.fetch(new Request('https://worker.example/api/config?id=abcd1234'), env);

    assert.equal(options.status, 204);
    assert.equal(config.status, 200);
    assert.equal(calls, 0);
});

test('rate limiter failure is fail-open and reaches normal validation', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        const response = await worker.fetch(new Request('https://worker.example/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        }), {
            ORDER_RATE_LIMITER: { async limit() { throw new Error('unavailable'); } },
        });
        assert.equal(response.status, 500);
        assert.match((await response.json()).error, /Worker misconfigured/);
    } finally {
        console.warn = originalWarn;
    }
});

test('valid public order sends preview and PNG document without authentication', async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        if (String(url).endsWith('/sendMediaGroup')) {
            return Response.json({ ok: true, result: [{ message_id: 1 }] });
        }
        return Response.json({
            ok: true,
            result: { message_id: 2, document: { file_id: 'file-1' } },
        });
    };

    try {
        const response = await worker.fetch(new Request('https://worker.example/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                svg: '<svg>valid</svg>',
                png: PNG_DATA_URL,
                front_png: PNG_DATA_URL,
                filename: 'brelok-A001AA77.png',
                number: 'A001AA',
                region: '77',
            }),
        }), {
            TG_BOT_TOKEN: 'token',
            TG_CHAT_IDS: '123',
            ORDER_RATE_LIMITER: { async limit() { return { success: true }; } },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);
        assert.equal(calls.length, 2);
        assert.match(calls[0], /sendMediaGroup$/);
        assert.match(calls[1], /sendDocument$/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('sendDocument body carries SVG, not PNG, when both are provided', async () => {
    const originalFetch = globalThis.fetch;
    const documents = [];
    globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.endsWith('/sendMediaGroup')) {
            return Response.json({ ok: true, result: [{ message_id: 1 }] });
        }
        if (u.endsWith('/sendDocument') && init && init.body) {
            documents.push(init.body);
        }
        return Response.json({
            ok: true,
            result: { message_id: 2, document: { file_id: 'file-1' } },
        });
    };

    try {
        const response = await worker.fetch(new Request('https://worker.example/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                svg: '<svg width="10.56cm" height="1.07cm">brelok</svg>',
                png: PNG_DATA_URL,
                front_png: PNG_DATA_URL,
                filename: 'brelok-A001AA77.svg',
                number: 'A001AA',
                region: '77',
            }),
        }), {
            TG_BOT_TOKEN: 'token',
            TG_CHAT_IDS: '123',
            ORDER_RATE_LIMITER: { async limit() { return { success: true }; } },
        });
        assert.equal(response.status, 200);
        assert.equal(documents.length, 1);
        const body = Buffer.from(documents[0]).toString('latin1');
        // Filename matches what the client sent (no .png rewrite).
        assert.match(body, /name="document"; filename="brelok-A001AA77\.svg"/);
        // MIME is image/svg+xml (the SVG MIME), not image/png.
        assert.match(body, /Content-Type: image\/svg\+xml/);
        // Body does NOT contain PNG bytes — only the SVG string.
        assert.equal(body.includes('10.56cm'), true);
        assert.equal(Buffer.from(documents[0]).includes(Buffer.from(PNG_SIGNATURE)), false);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('phishing site configuration skips only optional button', async () => {
    const originalFetch = globalThis.fetch;
    const originalWarn = console.warn;
    const calls = [];
    globalThis.fetch = async (url) => {
        calls.push(String(url));
        if (String(url).endsWith('/sendMediaGroup')) {
            return Response.json({ ok: true, result: [{ message_id: 1 }] });
        }
        return Response.json({
            ok: true,
            result: { message_id: 2, document: { file_id: 'file-1' } },
        });
    };
    console.warn = () => {};

    try {
        const response = await worker.fetch(new Request('https://worker.example/api/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                svg: '<svg>valid</svg>',
                png: PNG_DATA_URL,
                front_png: PNG_DATA_URL,
                config: '{"version":1}',
            }),
        }), {
            TG_BOT_TOKEN: 'token',
            TG_CHAT_IDS: '123',
            SITE_BASE_URL: 'https://phishing.example',
            BRELOK_CONFIG: { async put() {} },
        });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.ok, true);
        assert.equal(body.results[0].config_button.skipped, true);
        assert.equal(calls.some((url) => url.endsWith('/sendMessage')), false);
    } finally {
        globalThis.fetch = originalFetch;
        console.warn = originalWarn;
    }
});
