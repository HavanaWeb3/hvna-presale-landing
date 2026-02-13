// ═══════════════════════════════════════════════════════════════
// HVNA PRESALE - EMAIL SUBSCRIPTION API
// Vercel Serverless Function
// ═══════════════════════════════════════════════════════════════

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Audience ID is created on first request and cached in memory.
// Vercel cold starts will re-fetch it, which is fine.
let cachedAudienceId = null;

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            email,
            walletAddress,
            purchaseAmount,
            tokenAmount,
            transactionHash,
            phase,
            source,
            timestamp
        } = req.body;

        // Validate input
        if (!email || !validateEmail(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        if (!walletAddress || !purchaseAmount || !tokenAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const buyerTier = getBuyerTier(purchaseAmount);

        const subscriberData = {
            email,
            walletAddress,
            purchaseAmount,
            tokenAmount,
            transactionHash,
            phase,
            source,
            buyerTier,
            timestamp,
            subscribedAt: new Date().toISOString()
        };

        console.log('New subscriber:', JSON.stringify(subscriberData));

        // ── PERSISTENT STORAGE: Save contact to Resend Audiences ──
        let contactSaved = false;
        try {
            const audienceId = await getOrCreateAudience();
            await resend.contacts.create({
                audienceId: audienceId,
                email: email,
                firstName: walletAddress,          // Store wallet in firstName field
                lastName: `${buyerTier}|${phase}`, // Store tier+phase in lastName
                unsubscribed: false
            });
            contactSaved = true;
            console.log('Contact saved to Resend Audience:', email);
        } catch (contactError) {
            console.error('Failed to save contact (continuing):', contactError.message);
        }

        // ── SEND WELCOME EMAIL ──
        let emailSent = false;
        try {
            await sendWelcomeEmail(email, subscriberData);
            emailSent = true;
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError.message);
        }

        // ── BACKUP: Send notification to admin ──
        try {
            await resend.emails.send({
                from: 'HVNA Presale <hello@contentlynk.com>',
                to: 'hello@contentlynk.com',
                subject: `New $HVNA Buyer: ${email} (${buyerTier})`,
                text: [
                    `New token buyer submitted their email:`,
                    ``,
                    `Email: ${email}`,
                    `Wallet: ${walletAddress}`,
                    `Amount: EUR ${purchaseAmount}`,
                    `Tokens: ${tokenAmount} HVNA`,
                    `Tier: ${buyerTier}`,
                    `Phase: ${phase}`,
                    `TX: https://basescan.org/tx/${transactionHash}`,
                    `Time: ${timestamp}`,
                    ``,
                    `Contact saved to Resend: ${contactSaved ? 'YES' : 'FAILED'}`,
                    `Welcome email sent: ${emailSent ? 'YES' : 'FAILED'}`
                ].join('\n')
            });
        } catch (notifyError) {
            console.error('Admin notification failed:', notifyError.message);
        }

        return res.status(200).json({
            success: true,
            message: 'Successfully subscribed',
            data: {
                email,
                tier: buyerTier,
                emailSent,
                contactSaved
            }
        });

    } catch (error) {
        console.error('Email subscription error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESEND AUDIENCE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function getOrCreateAudience() {
    if (cachedAudienceId) return cachedAudienceId;

    const AUDIENCE_NAME = 'HVNA Presale Buyers';

    // Check if audience already exists
    const { data: audiences } = await resend.audiences.list();
    if (audiences && audiences.data) {
        const existing = audiences.data.find(a => a.name === AUDIENCE_NAME);
        if (existing) {
            cachedAudienceId = existing.id;
            return cachedAudienceId;
        }
    }

    // Create new audience
    const { data: newAudience } = await resend.audiences.create({
        name: AUDIENCE_NAME
    });
    cachedAudienceId = newAudience.id;
    console.log('Created Resend audience:', cachedAudienceId);
    return cachedAudienceId;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getBuyerTier(amount) {
    if (amount >= 1000) return 'Whale-Buyer';
    if (amount >= 100) return 'Regular-Buyer';
    return 'Small-Buyer';
}

async function sendWelcomeEmail(email, subscriberData) {
    const basescanLink = `https://basescan.org/tx/${subscriberData.transactionHash}`;
    const amt = Number(subscriberData.purchaseAmount) || 0;
    const tokens = Number(subscriberData.tokenAmount) || 0;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to the $HVNA Journey!</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
            color: white;
            padding: 30px;
            border-radius: 12px 12px 0 0;
            text-align: center;
        }
        .content {
            background: #f9f9f9;
            padding: 30px;
            border-radius: 0 0 12px 12px;
        }
        .highlight-box {
            background: white;
            border-left: 4px solid #FF6B35;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 50px;
            margin: 10px 5px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
        ul { padding-left: 20px; }
        li { margin: 8px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to the $HVNA Journey!</h1>
    </div>

    <div class="content">
        <p>Thank you for being an early believer in the Havana Elephant ecosystem!</p>

        <div class="highlight-box">
            <h2>Your Purchase Details:</h2>
            <div class="detail-row">
                <span>Amount:</span>
                <strong>&euro;${amt.toFixed(2)}</strong>
            </div>
            <div class="detail-row">
                <span>Tokens:</span>
                <strong>${tokens.toLocaleString('en-US')} $HVNA</strong>
            </div>
            <div class="detail-row">
                <span>Price:</span>
                <strong>&euro;0.01 per token</strong>
            </div>
            <div class="detail-row">
                <span>Transaction:</span>
                <a href="${basescanLink}" target="_blank">View on Basescan</a>
            </div>
        </div>

        <h3>What This Means:</h3>
        <p>You're now part of an exclusive group of early presale participants who got in at the ground floor. Your tokens are in your wallet and ready for the upcoming launch.</p>

        <h3>What Happens Next:</h3>
        <ul>
            <li><strong>NOW:</strong> You have your $HVNA tokens</li>
            <li><strong>Ongoing:</strong> Presale continues through multiple phases</li>
            <li><strong>Q2 2026:</strong> Contentlynk beta launch (you get priority access)</li>
            <li><strong>Q3 2026:</strong> Public token launch on DEXs</li>
        </ul>

        <div style="text-align: center; margin: 30px 0;">
            <h3>Join the Community:</h3>
            <a href="https://discord.gg/hzfTpjgy4" class="cta-button">Discord</a>
            <a href="https://t.me/havanaelephantbrand" class="cta-button">Telegram</a>
            <a href="https://twitter.com/havanaWeb3" class="cta-button">X/Twitter</a>
        </div>

        <h3>Your Next Steps:</h3>
        <ol>
            <li>Join our Discord for daily updates</li>
            <li>Follow us on X for announcements</li>
            <li>Bookmark havanaelephant.com for news</li>
            <li>Watch your email for presale phase alerts</li>
        </ol>

        <p><strong>Questions?</strong> Reply to this email or join Discord for community support.</p>

        <p style="margin-top: 30px;">
            <strong>Live Life Big in Style Celebrate,</strong><br>
            David Sime<br>
            Founder &amp; CEO, Havana Elephant Global S.A.
        </p>

        <div style="text-align: center; margin: 20px 0;">
            <a href="https://www.linkedin.com/in/davidjsime" style="margin: 0 10px;">LinkedIn</a> |
            <a href="https://havanaelephant.com" style="margin: 0 10px;">Website</a> |
            <a href="https://havanaelephant.com/whitepaper.pdf" style="margin: 0 10px;">White Paper</a>
        </div>
    </div>

    <div class="footer">
        <p>&copy; 2026 Havana Elephant Global S.A. | Panama</p>
        <p style="font-size: 12px; margin-top: 10px;">
            <a href="https://presale.havanaelephant.com/unsubscribe">Unsubscribe</a> |
            <a href="https://havanaelephant.com/privacy">Privacy Policy</a> |
            <a href="https://havanaelephant.com/terms">Terms</a>
        </p>
    </div>
</body>
</html>
    `;

    const emailText = `Welcome to the $HVNA Journey!

Thank you for being an early believer in the Havana Elephant ecosystem!

Your Purchase Details:
- Amount: EUR ${amt.toFixed(2)}
- Tokens: ${tokens.toLocaleString('en-US')} $HVNA
- Price: EUR 0.01 per token
- Transaction: ${basescanLink}

What Happens Next:
- NOW: You have your $HVNA tokens
- Ongoing: Presale continues through multiple phases
- Q2 2026: Contentlynk beta launch (you get priority access)
- Q3 2026: Public token launch on DEXs

Join the Community:
Discord: https://discord.gg/hzfTpjgy4
Telegram: https://t.me/havanaelephantbrand
X/Twitter: https://twitter.com/havanaWeb3

Questions? Reply to this email or join Discord.

Live Life Big in Style Celebrate,
David Sime
Founder & CEO, Havana Elephant Global S.A.
    `;

    const { data, error } = await resend.emails.send({
        from: 'David Sime - Havana Elephant <hello@contentlynk.com>',
        to: email,
        subject: 'Welcome to the $HVNA Journey!',
        html: emailHtml,
        text: emailText,
        tags: [
            { name: 'category', value: 'welcome' },
            { name: 'tier', value: subscriberData.buyerTier }
        ]
    });

    if (error) {
        throw new Error('Failed to send email: ' + error.message);
    }

    console.log('Welcome email sent:', data);
    return data;
}
