// POST /api/track-click
// Fire-and-forget click tracking into the shared Supabase button_clicks table.
// Mirrors the main site's trackButtonClick() so both sites feed the same dashboard.

const ALLOWED_ORIGINS = ['https://presale.havanaelephant.com'];

// Only names this site actually sends. main.js sends presale_buy; add a name
// here when you add a button, otherwise the insert is refused.
const ALLOWED_BUTTONS = ['presale_buy'];

module.exports = async function handler(req, res) {
    const origin = req.headers.origin;

    res.setHeader('Vary', 'Origin');

    if (!origin || ALLOWED_ORIGINS.indexOf(origin) === -1) {
        console.warn('track-click: refused origin:', origin || '(none)');
        return res.status(403).json({ error: 'Forbidden' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
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

    if (!button_name || typeof button_name !== 'string') {
        return res.status(400).json({ error: 'button_name is required' });
    }
    if (ALLOWED_BUTTONS.indexOf(button_name.trim()) === -1) {
        console.warn('track-click: refused button_name of length', button_name.length);
        return res.status(400).json({ error: 'Unrecognised button_name' });
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
