'use strict';

// Test doubles for the four serverless handlers.
// No secrets, no network: every provider call is stubbed, and any attempt to
// reach the real network fails the test that made it.

const path = require('path');

const ORIGIN = 'https://presale.havanaelephant.com';
const apiPath = file => path.join(__dirname, '..', 'api', file);

// Fake env. These are not credentials — the stubs never check them.
process.env.RESEND_API_KEY = 'stub-resend-key';
process.env.DIDIT_API_KEY = 'stub-didit-key';
process.env.DIDIT_WORKFLOW_ID = 'stub-workflow';
process.env.SUPABASE_URL = 'https://stub.supabase.co';
process.env.SUPABASE_ANON_KEY = 'stub-anon-key';

function makeRes() {
    return {
        statusCode: null,
        headers: {},
        body: undefined,
        ended: false,
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        getHeader(k) { return this.headers[k.toLowerCase()]; },
        status(c) { this.statusCode = c; return this; },
        json(o) { this.body = o; this.ended = true; return this; },
        end() { this.ended = true; return this; }
    };
}

function makeReq(o) {
    o = o || {};
    const headers = Object.assign({ origin: ORIGIN }, o.headers || {});
    if (o.origin === null) delete headers.origin;
    else if (o.origin) headers.origin = o.origin;
    return {
        method: o.method || 'POST',
        headers: headers,
        body: 'body' in o ? o.body : {},
        query: o.query || {}
    };
}

// Re-require a handler so module-level state (cachedAudienceId) never leaks
// between tests.
function freshHandler(file) {
    const p = require.resolve(apiPath(file));
    delete require.cache[p];
    return require(p);
}

// Seed require.cache so the handler's `require('resend')` gets a recorder.
function installResendStub(opts) {
    opts = opts || {};
    const calls = [];
    const id = require.resolve('resend');
    require.cache[id] = {
        id: id, filename: id, loaded: true, exports: {
            Resend: class {
                constructor() {
                    this.emails = {
                        send: async arg => {
                            calls.push({ kind: 'email', arg: arg });
                            if (opts.sendThrows) throw new Error('stub send failure');
                            return { data: { id: 'stub-email-id' }, error: null };
                        }
                    };
                    this.contacts = {
                        create: async arg => {
                            calls.push({ kind: 'contact', arg: arg });
                            return { data: {}, error: null };
                        }
                    };
                    this.audiences = {
                        list: async () => ({ data: { data: [{ name: 'HVNA Presale Buyers', id: 'aud_stub' }] } }),
                        create: async () => ({ data: { id: 'aud_stub' } })
                    };
                }
            }
        }
    };
    return calls;
}

function denyNetwork() {
    globalThis.fetch = async url => {
        throw new Error('REAL NETWORK CALL ATTEMPTED: ' + url);
    };
}

function stubFetch(responder) {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        const call = { url: String(url), options: options || {} };
        calls.push(call);
        return responder(call, calls.length);
    };
    return calls;
}

function fetchResponse(o) {
    o = o || {};
    const status = o.status || 200;
    const headers = o.headers || {};
    return {
        status: status,
        ok: status >= 200 && status < 300,
        json: async () => {
            if (o.badJson) throw new Error('not json');
            return o.body || {};
        },
        headers: { get: k => (k.toLowerCase() in headers ? headers[k.toLowerCase()] : null) }
    };
}

function validPayload(over) {
    return Object.assign({
        email: 'buyer@example.com',
        walletAddress: '0x' + 'a'.repeat(40),
        purchaseAmount: 250,
        tokenAmount: 25000,
        transactionHash: '0x' + 'b'.repeat(64),
        phase: 'Seed Round',
        source: 'Landing-Page-Purchase',
        timestamp: new Date().toISOString()
    }, over || {});
}

function emailsSent(calls) {
    return calls.filter(c => c.kind === 'email');
}

function allEmailText(calls) {
    return emailsSent(calls)
        .map(c => [c.arg.html || '', c.arg.text || '', c.arg.subject || ''].join('\n'))
        .join('\n');
}

module.exports = {
    ORIGIN, makeRes, makeReq, freshHandler, installResendStub,
    denyNetwork, stubFetch, fetchResponse, validPayload, emailsSent, allEmailText
};
