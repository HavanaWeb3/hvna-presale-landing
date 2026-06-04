// POST /api/track-click
// Fire-and-forget click tracking into the shared Supabase button_clicks table.
// Mirrors the main site's trackButtonClick() so both sites feed the same dashboard.

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://presale.havanaelephant.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('track-click: SUPABASE_URL or SUPABASE_ANON_KEY not configured');
        return res.status(503).json({ error: 'Tracking service not configured' });
    }

    const { button_name } = req.body || {};

    if (!button_name || typeof button_name !== 'string' || button_name.trim().length === 0) {
        return res.status(400).json({ error: 'button_name is required' });
    }
    if (button_name.length > 100) {
        return res.status(400).json({ error: 'button_name exceeds maximum length' });
    }

    try {
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/button_clicks`, {
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ button_name: button_name.trim() })
        });

        if (!insertRes.ok) {
            console.error('track-click: Supabase insert failed', insertRes.status);
            return res.status(502).json({ error: 'Tracking insert failed' });
        }

        return res.status(204).end();

    } catch (err) {
        console.error('track-click: network error', err.message);
        return res.status(502).json({ error: 'Could not reach tracking service' });
    }
};
