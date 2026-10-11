'use strict';

// Red-first suite for the four api/ handlers.
// Every test below fails against the pre-fix code and passes after the fixes.
// Run: node --test test/

const { test } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');

const WALLET = '0x' + 'a'.repeat(40);
const HASH = '0x' + 'b'.repeat(64);

// ── 1 ────────────────────────────────────────────────────────────────────
test('1. email-subscribe rejects a foreign origin and sends nothing', async () => {
    H.denyNetwork();
    const calls = H.installResendStub();
    const handler = H.freshHandler('email-subscribe.js');
    const res = H.makeRes();

    await handler(H.makeReq({ origin: 'https://evil.example', body: H.validPayload() }), res);

    assert.equal(res.statusCode, 403, 'foreign origin must be refused');
    assert.notEqual(res.getHeader('access-control-allow-origin'), '*', 'must not advertise ACAO: *');
    assert.equal(H.emailsSent(calls).length, 0, 'no mail may be sent to a foreign-origin caller');
});

// ── 2 ────────────────────────────────────────────────────────────────────
test('2. email-subscribe refuses a malformed transactionHash and never emits it', async () => {
    H.denyNetwork();
    const calls = H.installResendStub();
    const handler = H.freshHandler('email-subscribe.js');
    const res = H.makeRes();
    const evil = '0x" onmouseover="alert(1)" x="';

    await handler(H.makeReq({ body: H.validPayload({ transactionHash: evil }) }), res);

    assert.equal(res.statusCode, 400, 'a non-hex transaction hash must be refused');
    const text = H.allEmailText(calls);
    assert.ok(!text.includes('onmouseover'), 'attacker markup must never reach an email body');
    assert.ok(!text.includes('" x="'), 'attribute break-out must never reach an email body');
});

// ── 3 ────────────────────────────────────────────────────────────────────
test('3. email-subscribe returns a generic error, never error.message', async () => {
    H.denyNetwork();
    H.installResendStub();
    const handler = H.freshHandler('email-subscribe.js');
    const res = H.makeRes();

    await handler(H.makeReq({ body: undefined }), res);

    assert.ok(res.statusCode >= 400, 'a missing body is an error');
    assert.ok(res.body && typeof res.body === 'object', 'an error body is returned');
    assert.ok(!('message' in res.body), 'internal detail must not be returned to the caller');
    assert.ok(!/stack|TypeError|Cannot destructure|undefined/i.test(JSON.stringify(res.body)),
        'no internal detail may leak through any field');
});

// ── 4 ────────────────────────────────────────────────────────────────────
test('4. email-subscribe caps field length and bounds the amounts', async () => {
    H.denyNetwork();

    {
        const calls = H.installResendStub();
        const handler = H.freshHandler('email-subscribe.js');
        const res = H.makeRes();
        const longEmail = 'a'.repeat(300) + '@example.com';
        await handler(H.makeReq({ body: H.validPayload({ email: longEmail }) }), res);
        assert.equal(res.statusCode, 400, 'a 312-character email must be refused');
        assert.equal(H.emailsSent(calls).length, 0, 'nothing is sent for an over-long address');
    }

    {
        const calls = H.installResendStub();
        const handler = H.freshHandler('email-subscribe.js');
        const res = H.makeRes();
        await handler(H.makeReq({ body: H.validPayload({ purchaseAmount: '1e30' }) }), res);
        assert.equal(res.statusCode, 400, 'an absurd purchase amount must be refused');
        assert.equal(H.emailsSent(calls).length, 0, 'nothing is sent for an out-of-range amount');
    }
});

// ── 5 ────────────────────────────────────────────────────────────────────
test('5. email-subscribe validates the wallet address before sending anything', async () => {
    H.denyNetwork();
    const calls = H.installResendStub();
    const handler = H.freshHandler('email-subscribe.js');
    const res = H.makeRes();

    await handler(H.makeReq({ body: H.validPayload({ walletAddress: 'not-a-wallet' }) }), res);

    assert.equal(res.statusCode, 400, 'a non-address wallet must be refused');
    assert.equal(calls.length, 0, 'no provider call of any kind may be made');
});

// ── 6 ────────────────────────────────────────────────────────────────────
test('6. didit-status refuses a traversing session_id and never builds that URL', async () => {
    const fetchCalls = H.stubFetch(() => H.fetchResponse({ status: 200, body: { status: 'Approved' } }));
    const handler = H.freshHandler('didit-status.js');
    const res = H.makeRes();

    await handler(H.makeReq({ method: 'GET', query: { session_id: '../../sessions?limit=1000' } }), res);

    assert.equal(res.statusCode, 400, 'a non-UUID session_id must be refused');
    assert.ok(!fetchCalls.some(c => c.url.includes('../')),
        'a traversing path must never be sent to the provider');
    assert.equal(fetchCalls.length, 0, 'no provider call may be made at all');
});

// ── 7 ────────────────────────────────────────────────────────────────────
test('7. didit-status validates the wallet format', async () => {
    const fetchCalls = H.stubFetch(() => H.fetchResponse({ status: 200, body: { status: 'Approved' } }));
    const handler = H.freshHandler('didit-status.js');
    const res = H.makeRes();

    await handler(H.makeReq({ method: 'GET', query: { wallet: 'not-a-wallet' } }), res);

    assert.equal(res.statusCode, 400, 'a non-address wallet must be refused');
    assert.equal(fetchCalls.length, 0, 'no provider call may be made');
});

// ── 8 ────────────────────────────────────────────────────────────────────
test('8. didit-session ignores x-forwarded-host when building the callback', async () => {
    const fetchCalls = H.stubFetch(() => H.fetchResponse({
        status: 201, body: { session_id: 'stub-session', url: 'https://verification.didit.me/x' }
    }));
    const handler = H.freshHandler('didit-session.js');
    const res = H.makeRes();

    await handler(H.makeReq({
        headers: { 'x-forwarded-host': 'evil.example', 'x-forwarded-proto': 'http' },
        body: { wallet: WALLET }
    }), res);

    assert.equal(fetchCalls.length, 1, 'the session request is made');
    const sent = JSON.parse(fetchCalls[0].options.body);
    assert.ok(!String(sent.callback).includes('evil.example'),
        'a forged host header must not steer the callback');
    assert.ok(String(sent.callback).startsWith('https://presale.havanaelephant.com/'),
        'the callback must be pinned to the real site');
});

// ── 9 ────────────────────────────────────────────────────────────────────
test('9. didit-session does not echo provider error detail', async () => {
    H.stubFetch(() => H.fetchResponse({
        status: 400, body: { detail: 'workflow 12345 not permitted for account acct_internal' }
    }));
    const handler = H.freshHandler('didit-session.js');
    const res = H.makeRes();

    await handler(H.makeReq({ body: { wallet: WALLET } }), res);

    assert.ok(res.statusCode >= 400, 'a provider rejection is an error');
    assert.ok(!('detail' in (res.body || {})), 'provider detail must not be returned to the caller');
    assert.ok(!/acct_internal|workflow 12345/.test(JSON.stringify(res.body || {})),
        'no provider internals may leak through any field');
});

// ── 10 ───────────────────────────────────────────────────────────────────
test('10. track-click accepts only whitelisted button names', async () => {
    {
        const fetchCalls = H.stubFetch(() => H.fetchResponse({ status: 201 }));
        const handler = H.freshHandler('track-click.js');
        const res = H.makeRes();
        await handler(H.makeReq({ body: { button_name: 'arbitrary-attacker-string' } }), res);
        assert.equal(res.statusCode, 400, 'an unknown button name must be refused');
        assert.equal(fetchCalls.length, 0, 'nothing may be written to the table');
    }

    {
        const fetchCalls = H.stubFetch(() => H.fetchResponse({ status: 201 }));
        const handler = H.freshHandler('track-click.js');
        const res = H.makeRes();
        await handler(H.makeReq({ body: { button_name: 'presale_buy' } }), res);
        assert.equal(res.statusCode, 204, 'the real button name still works');
        assert.equal(fetchCalls.length, 1, 'the insert is still performed');
    }
});

// ── 11 ───────────────────────────────────────────────────────────────────
test('11. every handler refuses a request carrying no Origin', async () => {
    const cases = [
        ['email-subscribe.js', { body: H.validPayload() }],
        ['didit-session.js', { body: { wallet: WALLET } }],
        ['didit-status.js', { method: 'GET', query: { wallet: WALLET } }],
        ['track-click.js', { body: { button_name: 'presale_buy' } }]
    ];

    for (const [file, reqOpts] of cases) {
        H.installResendStub();
        const fetchCalls = H.stubFetch(() => H.fetchResponse({ status: 201, body: { status: 'Approved' } }));
        const handler = H.freshHandler(file);
        const res = H.makeRes();

        await handler(H.makeReq(Object.assign({ origin: null }, reqOpts)), res);

        assert.equal(res.statusCode, 403, file + ' must refuse an origin-less request');
        assert.equal(fetchCalls.length, 0, file + ' must make no outbound call');
    }
});

// ── Regression guards ────────────────────────────────────────────────────
// These pass before and after the fixes. They exist so the hardening above
// cannot quietly break the real purchase flow.

test('12. email-subscribe still completes the genuine purchase flow', async () => {
    H.denyNetwork();
    const calls = H.installResendStub();
    const handler = H.freshHandler('email-subscribe.js');
    const res = H.makeRes();

    await handler(H.makeReq({ body: H.validPayload() }), res);

    assert.equal(res.statusCode, 200, 'a genuine submission succeeds');
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.tier, 'Regular-Buyer', 'tier is still derived from the amount');

    const emails = H.emailsSent(calls);
    assert.equal(emails.length, 2, 'welcome email plus admin notification');
    assert.ok(calls.some(c => c.kind === 'contact'), 'the contact is still saved to the audience');

    const welcome = emails.find(e => e.arg.to === 'buyer@example.com');
    assert.ok(welcome, 'the welcome email goes to the buyer');
    assert.ok(welcome.arg.html.includes('https://basescan.org/tx/0x' + 'b'.repeat(64)),
        'the Basescan link is still correct');
    assert.ok(welcome.arg.html.includes('$250.00'), 'the amount still renders');
    assert.ok(welcome.arg.html.includes('25,000 $HVNA'), 'the token count still renders');
});

test('13. didit-session still returns a session for a valid wallet', async () => {
    const fetchCalls = H.stubFetch(() => H.fetchResponse({
        status: 201, body: { session_id: 'stub-session', url: 'https://verification.didit.me/s/abc' }
    }));
    const handler = H.freshHandler('didit-session.js');
    const res = H.makeRes();

    await handler(H.makeReq({ body: { wallet: WALLET } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.sessionId, 'stub-session');
    assert.equal(res.body.sessionUrl, 'https://verification.didit.me/s/abc');
    assert.equal(fetchCalls.length, 1);
    const sent = JSON.parse(fetchCalls[0].options.body);
    assert.equal(sent.vendor_data, WALLET.toLowerCase(), 'the wallet is still passed as vendor_data');
});

test('14. didit-status still resolves a wallet to its latest decision', async () => {
    const fetchCalls = H.stubFetch(call => {
        if (call.url.includes('/v3/sessions?')) {
            return H.fetchResponse({
                status: 200, body: {
                    results: [
                        { session_id: '11111111-1111-4111-8111-111111111111', status: 'In Progress', created_at: '2026-10-01T00:00:00Z' },
                        { session_id: '22222222-2222-4222-8222-222222222222', status: 'In Progress', created_at: '2026-10-09T00:00:00Z' }
                    ]
                }
            });
        }
        return H.fetchResponse({ status: 200, body: { status: 'Approved' } });
    });
    const handler = H.freshHandler('didit-status.js');
    const res = H.makeRes();

    await handler(H.makeReq({ method: 'GET', query: { wallet: WALLET } }), res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'Approved', 'the authoritative decision status is returned');
    assert.ok(fetchCalls[1].url.includes('22222222-2222-4222-8222-222222222222'),
        'the most recent session is the one resolved');
});
