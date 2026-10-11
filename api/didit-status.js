// GET /api/didit-status?wallet=0x...  (primary)
//                      ?session_id=<uuid>  (fallback)
// Returns { status } for the most recent KYC session for a wallet.
// Didit's top-level "Approved" already incorporates AML — no separate amlClear field needed.

const ALLOWED_ORIGINS = ['https://presale.havanaelephant.com'];
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CLIENT_HEADER_VALUE = 'web';

// This endpoint is reached by a same-origin GET (web3.js fetchKycStatus), and
// browsers do not send Origin on those — only on cross-origin requests and on
// POSTs. Requiring Origin here therefore refuses every genuine buyer, so the
// same-origin case is recognised by Sec-Fetch-Site instead, which browsers do
// send on every fetch. The three POST endpoints always receive an Origin and
// keep the simpler check.
function isAllowedCaller(req) {
    const origin = req.headers.origin;
    const site = req.headers['sec-fetch-site'];

    // An explicit cross-site or same-site value is a refusal whatever else says.
    if (site === 'cross-site' || site === 'same-site') return false;

    if (origin) return ALLOWED_ORIGINS.indexOf(origin) !== -1;

    if (site === 'same-origin') return true;

    // Safari before 16.4 sends neither Origin nor Sec-Fetch-Site on a
    // same-origin GET, so fetchKycStatus adds this header as a third proof.
    // A cross-origin page cannot set it without a preflight, and that
    // preflight carries an Origin which the rule above refuses. A bare curl
    // sending none of the three stays refused.
    return req.headers['x-hvna-client'] === CLIENT_HEADER_VALUE;
}

module.exports = async function handler(req, res) {
    const origin = req.headers.origin;

    res.setHeader('Vary', 'Origin, Sec-Fetch-Site, X-HVNA-Client');

    if (!isAllowedCaller(req)) {
        console.warn('didit-status: refused caller. origin:', origin || '(none)',
            'sec-fetch-site:', req.headers['sec-fetch-site'] || '(none)');
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Only meaningful for a cross-origin caller; a same-origin GET needs none.
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const query = req.query || {};
    const wallet = typeof query.wallet === 'string' ? query.wallet.trim() : '';
    const session_id = typeof query.session_id === 'string' ? query.session_id.trim() : '';

    if (!wallet && !session_id) {
        return res.status(400).json({ error: 'Provide wallet or session_id query parameter' });
    }

    // Both values are interpolated into provider URLs below, so both are
    // format-checked here. Without this a session_id of '../../sessions'
    // reaches Didit's session-list endpoint carrying our API key.
    if (wallet && !WALLET_RE.test(wallet)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    if (session_id && !UUID_RE.test(session_id)) {
        return res.status(400).json({ error: 'Invalid session_id' });
    }

    const apiKey = process.env.DIDIT_API_KEY;
    if (!apiKey) {
        console.error('didit-status: DIDIT_API_KEY not configured');
        return res.status(503).json({ error: 'KYC service not configured' });
    }

    const authHeaders = { 'x-api-key': apiKey };
    let decision;

    if (wallet) {
        // Primary path: list sessions filtered by vendor_data (wallet address)
        const walletLower = wallet.toLowerCase();
        let listRes;
        try {
            const qs = new URLSearchParams({ vendor_data: walletLower, limit: '5' });
            listRes = await fetch('https://verification.didit.me/v3/sessions?' + qs.toString(), {
                headers: authHeaders
            });
        } catch (err) {
            console.error('didit-status: network error on list:', err.message);
            return res.status(502).json({ error: 'Could not reach verification service' });
        }

        if (listRes.status === 401 || listRes.status === 403) {
            return res.status(502).json({ error: 'Verification service authentication error' });
        }
        if (!listRes.ok) {
            return res.status(502).json({ error: 'Verification service error', status: listRes.status });
        }

        let listBody;
        try { listBody = await listRes.json(); } catch {
            return res.status(502).json({ error: 'Invalid response from verification service' });
        }

        const results = Array.isArray(listBody.results) ? listBody.results : [];
        if (results.length === 0) {
            return res.status(200).json({ status: 'Not Started' });
        }

        // Most recent session — sort by created_at descending
        const sorted = results.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const latest = sorted[0];

        // Fetch full decision for authoritative top-level status
        let decisionRes;
        try {
            decisionRes = await fetch(
                'https://verification.didit.me/v3/session/' +
                    encodeURIComponent(latest.session_id) + '/decision/',
                { headers: authHeaders }
            );
        } catch (err) {
            // Network error on decision fetch — return list-level status as fallback
            return res.status(200).json({ status: latest.status });
        }

        if (!decisionRes.ok) {
            return res.status(200).json({ status: latest.status });
        }

        try { decision = await decisionRes.json(); } catch {
            return res.status(200).json({ status: latest.status });
        }

    } else {
        // Fallback path: direct session_id → decision endpoint
        let decisionRes;
        try {
            decisionRes = await fetch(
                'https://verification.didit.me/v3/session/' +
                    encodeURIComponent(session_id) + '/decision/',
                { headers: authHeaders }
            );
        } catch (err) {
            console.error('didit-status: network error on decision:', err.message);
            return res.status(502).json({ error: 'Could not reach verification service' });
        }

        if (decisionRes.status === 401 || decisionRes.status === 403) {
            return res.status(502).json({ error: 'Verification service authentication error' });
        }
        if (decisionRes.status === 404) {
            return res.status(200).json({ status: 'Not Started' });
        }
        if (!decisionRes.ok) {
            return res.status(502).json({ error: 'Verification service error', status: decisionRes.status });
        }

        try { decision = await decisionRes.json(); } catch {
            return res.status(502).json({ error: 'Invalid response from verification service' });
        }
    }

    return res.status(200).json({
        status: decision.status || 'Not Started'
    });
};
