// ═══════════════════════════════════════════════════════════════
// HVNA PRESALE - EMAIL SUBSCRIPTION API
// Vercel Serverless Function
// ═══════════════════════════════════════════════════════════════

// This function requires Resend API for sending emails
// Install: npm install resend

import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Database would be used here (e.g., Supabase, PostgreSQL)
// For now, we'll use a simple file-based approach or API

export default async function handler(req, res) {
    // Only allow POST requests
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

        // Check for required fields
        if (!walletAddress || !purchaseAmount || !tokenAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Rate limiting (simple implementation)
        // In production, use Redis or similar
        const rateLimitKey = `email_${email}`;
        // TODO: Implement rate limiting check

        // Determine buyer tier
        const buyerTier = getBuyerTier(purchaseAmount);

        // Store subscriber data
        // In production, this would go to a database
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
            tags: [
                'Token-Buyer',
                `${phase.replace(' ', '-')}-Buyer`,
                buyerTier,
                'Email-Provided',
                'Opted-In-Post-Purchase'
            ],
            subscribed: true,
            subscribedAt: new Date().toISOString()
        };

        // Save to database (example using Supabase)
        // Uncomment and configure when ready
        /*
        const { data, error } = await supabase
            .from('subscribers')
            .insert([subscriberData]);

        if (error) {
            throw new Error('Failed to save subscriber: ' + error.message);
        }
        */

        // For now, log the data
        console.log('New subscriber:', subscriberData);

        // Send welcome email using Resend
        try {
            await sendWelcomeEmail(email, subscriberData);
        } catch (emailError) {
            console.error('Error sending welcome email:', emailError);
            // Don't fail the request if email fails
        }

        // Return success
        return res.status(200).json({
            success: true,
            message: 'Successfully subscribed',
            data: {
                email,
                tier: buyerTier
            }
        });

    } catch (error) {
        console.error('Email subscription error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function getBuyerTier(amount) {
    if (amount >= 1000) return 'Whale-Buyer';
    if (amount >= 100) return 'Regular-Buyer';
    return 'Small-Buyer';
}

async function sendWelcomeEmail(email, subscriberData) {
    const basescanLink = `https://basescan.org/tx/${subscriberData.transactionHash}`;

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
        ul {
            padding-left: 20px;
        }
        li {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🐘 Welcome to the $HVNA Journey!</h1>
    </div>

    <div class="content">
        <p>Thank you for being an early believer in the Havana Elephant ecosystem!</p>

        <div class="highlight-box">
            <h2>Your Purchase Details:</h2>
            <div class="detail-row">
                <span>Amount:</span>
                <strong>€${subscriberData.purchaseAmount.toFixed(2)}</strong>
            </div>
            <div class="detail-row">
                <span>Tokens:</span>
                <strong>${subscriberData.tokenAmount.toLocaleString('en-US')} $HVNA</strong>
            </div>
            <div class="detail-row">
                <span>Price:</span>
                <strong>€0.01 per token</strong>
            </div>
            <div class="detail-row">
                <span>Transaction:</span>
                <a href="${basescanLink}" target="_blank">View on Basescan →</a>
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
            <a href="https://discord.gg/havanaelephant" class="cta-button">Discord</a>
            <a href="https://t.me/havanaelephant" class="cta-button">Telegram</a>
            <a href="https://twitter.com/havanaelephant" class="cta-button">X/Twitter</a>
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
            Founder & CEO, Havana Elephant Global S.A.
        </p>

        <div style="text-align: center; margin: 20px 0;">
            <a href="https://linkedin.com/in/davidsime" style="margin: 0 10px;">LinkedIn</a> |
            <a href="https://havanaelephant.com" style="margin: 0 10px;">Website</a> |
            <a href="https://havanaelephant.com/whitepaper.pdf" style="margin: 0 10px;">White Paper</a>
        </div>
    </div>

    <div class="footer">
        <p>© 2026 Havana Elephant Global S.A. | Panama</p>
        <p style="font-size: 12px; margin-top: 10px;">
            <a href="https://presale.havanaelephant.com/unsubscribe">Unsubscribe</a> |
            <a href="https://havanaelephant.com/privacy">Privacy Policy</a> |
            <a href="https://havanaelephant.com/terms">Terms</a>
        </p>
    </div>
</body>
</html>
    `;

    const emailText = `
Welcome to the $HVNA Journey!

Thank you for being an early believer in the Havana Elephant ecosystem!

Your Purchase Details:
- Amount: €${subscriberData.purchaseAmount.toFixed(2)}
- Tokens: ${subscriberData.tokenAmount.toLocaleString('en-US')} $HVNA
- Price: €0.01 per token
- Transaction: ${basescanLink}

What This Means:
You're now part of an exclusive group of early presale participants who got in at the ground floor.

What Happens Next:
- NOW: You have your $HVNA tokens
- Ongoing: Presale continues through multiple phases
- Q2 2026: Contentlynk beta launch (you get priority access)
- Q3 2026: Public token launch on DEXs

Join the Community:
Discord: https://discord.gg/havanaelephant
Telegram: https://t.me/havanaelephant
X/Twitter: https://twitter.com/havanaelephant

Your Next Steps:
1. Join our Discord for daily updates
2. Follow us on X for announcements
3. Bookmark havanaelephant.com for news
4. Watch your email for presale phase alerts

Questions? Reply to this email or join Discord.

Live Life Big in Style Celebrate,
David Sime
Founder & CEO, Havana Elephant Global S.A.

LinkedIn: https://linkedin.com/in/davidsime
Website: https://havanaelephant.com
White Paper: https://havanaelephant.com/whitepaper.pdf
    `;

    // Send email using Resend
    const { data, error } = await resend.emails.send({
        from: 'David Sime - Havana Elephant <hello@contentlynk.com>',
        to: email,
        subject: 'Welcome to the $HVNA Journey! 🐘',
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
