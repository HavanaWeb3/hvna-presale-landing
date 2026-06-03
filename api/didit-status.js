// GET /api/didit-status?wallet=0x...  (primary)
//                      ?session_id=<uuid>  (fallback)
// Returns { status } for the most recent KYC session for a wallet.
// Didit's top-level "Approved" already incorporates AML — no separate amlClear field needed.

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://presale.havanaelephant.com');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { wallet, session_id } = req.query || {};

    if (!wallet && !session_id) {
        return res.status(400).json({ error: 'Provide wallet or session_id query parameter' });
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
                'https://verification.didit.me/v3/session/' + latest.session_id + '/decision/',
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
                'https://verification.didit.me/v3/session/' + session_id + '/decision/',
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
