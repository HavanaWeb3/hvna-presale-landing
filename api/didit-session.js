// POST /api/didit-session
// Creates a Didit v3 KYC session for the given wallet address.
// Returns { sessionId, sessionUrl } on success.

const SITE_ORIGIN = 'https://presale.havanaelephant.com';
const ALLOWED_ORIGINS = [SITE_ORIGIN];

module.exports = async function handler(req, res) {
    const origin = req.headers.origin;

    res.setHeader('Vary', 'Origin');

    if (!origin || ALLOWED_ORIGINS.indexOf(origin) === -1) {
        console.warn('didit-session: refused origin:', origin || '(none)');
        return res.status(403).json({ error: 'Forbidden' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { wallet } = req.body || {};

    if (!wallet || typeof wallet !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) {
        return res.status(400).json({ error: 'Invalid or missing wallet address' });
    }

    const walletLower = wallet.trim().toLowerCase();
    const apiKey = process.env.DIDIT_API_KEY;
    const workflowId = process.env.DIDIT_WORKFLOW_ID;

    if (!apiKey || !workflowId) {
        console.error('didit-session: DIDIT_API_KEY or DIDIT_WORKFLOW_ID not configured');
        return res.status(503).json({ error: 'KYC service not configured' });
    }

    // Pinned rather than derived from request headers: a forged
    // x-forwarded-host must not be able to steer where Didit sends the
    // user once verification finishes.
    const callbackBase = SITE_ORIGIN;

    let diditRes;
    try {
        diditRes = await fetch('https://verification.didit.me/v3/session/', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                workflow_id: workflowId,
                vendor_data: walletLower,
                callback: `${callbackBase}/verify-complete.html`,
                callback_method: 'both'
            })
        });
    } catch (networkErr) {
        console.error('didit-session: network error reaching Didit:', networkErr.message);
        return res.status(502).json({ error: 'Could not reach verification service' });
    }

    let body;
    try {
        body = await diditRes.json();
    } catch {
        return res.status(502).json({ error: 'Invalid response from verification service' });
    }

    if (diditRes.status === 201) {
        return res.status(200).json({
            sessionId: body.session_id,
            sessionUrl: body.url
        });
    }

    // Error mapping — never echo the API key in error text
    if (diditRes.status === 400) {
        // Logged, never returned. web3.js reads data.detail || data.error, so
        // omitting detail leaves its fallback working.
        console.error('didit-session: Didit rejected request:', body.detail || body.message || body);
        return res.status(502).json({ error: 'Verification service rejected request' });
    }
    if (diditRes.status === 401 || diditRes.status === 403) {
        console.error('didit-session: Didit auth error', diditRes.status);
        return res.status(502).json({ error: 'Verification service authentication error' });
    }
    if (diditRes.status === 429) {
        const retryAfter = diditRes.headers.get('Retry-After') || '60';
        res.setHeader('Retry-After', retryAfter);
        return res.status(503).json({ error: 'Verification service rate limit reached', retryAfter });
    }

    console.error('didit-session: unexpected Didit status', diditRes.status);
    return res.status(502).json({ error: 'Verification service error', status: diditRes.status });
};
