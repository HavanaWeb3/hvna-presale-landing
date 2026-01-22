// ═══════════════════════════════════════════════════════════════
// HVNA PRESALE LANDING PAGE - EMAIL COLLECTION
// ═══════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL COLLECTION STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const emailState = {
    purchaseAmount: 0,
    tokenAmount: 0,
    transactionHash: null,
    walletAddress: null
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHOW EMAIL COLLECTION MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function showEmailCollectionModal(purchaseAmount, tokenAmount, transactionHash) {
    // Store purchase details
    emailState.purchaseAmount = purchaseAmount;
    emailState.tokenAmount = tokenAmount;
    emailState.transactionHash = transactionHash;
    emailState.walletAddress = web3Helpers.web3State.address;

    // Show modal
    const modal = document.getElementById('email-modal');
    modal.classList.add('active');

    // Track modal shown
    appHelpers.trackEvent('email_modal_shown', {
        purchase_amount: purchaseAmount,
        token_amount: tokenAmount
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLOSE EMAIL MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function closeEmailModal() {
    const modal = document.getElementById('email-modal');
    modal.classList.remove('active');

    // Reset form
    document.getElementById('email-form').reset();
    document.getElementById('email-form').style.display = 'block';
    document.getElementById('email-success').style.display = 'none';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKIP EMAIL COLLECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function skipEmail() {
    appHelpers.trackEvent('email_modal_dismissed', {
        purchase_amount: emailState.purchaseAmount
    });

    closeEmailModal();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUBMIT EMAIL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function submitEmail(event) {
    event.preventDefault();

    const emailInput = document.getElementById('subscriber-email');
    const email = emailInput.value.trim();

    // Validate email
    if (!isValidEmail(email)) {
        appHelpers.showNotification('Please enter a valid email address.', 'error');
        return;
    }

    // Disable submit button
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Subscribing...';

    try {
        appHelpers.trackEvent('email_submitted', {
            purchase_amount: emailState.purchaseAmount
        });

        // Submit to backend
        const response = await fetch('/api/email-subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                walletAddress: emailState.walletAddress,
                purchaseAmount: emailState.purchaseAmount,
                tokenAmount: emailState.tokenAmount,
                transactionHash: emailState.transactionHash,
                phase: 'Seed Round',
                source: 'Landing-Page-Purchase',
                timestamp: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Show success message
            document.getElementById('email-form').style.display = 'none';
            document.getElementById('email-success').style.display = 'block';

            appHelpers.trackEvent('email_submission_success', {
                purchase_amount: emailState.purchaseAmount
            });

            // Send welcome email
            await sendWelcomeEmail(email);

        } else {
            throw new Error(data.error || 'Failed to subscribe');
        }

    } catch (error) {
        console.error('Email submission error:', error);
        appHelpers.showNotification(
            'Failed to subscribe. You can still reach us at hello@contentlynk.com',
            'error'
        );

        appHelpers.trackEvent('email_submission_failed', {
            error: error.message,
            purchase_amount: emailState.purchaseAmount
        });

        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEND WELCOME EMAIL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function sendWelcomeEmail(email) {
    try {
        // This would call your email service (Resend API) to send welcome email
        await fetch('/api/send-welcome-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                purchaseAmount: emailState.purchaseAmount,
                tokenAmount: emailState.tokenAmount,
                transactionHash: emailState.transactionHash,
                walletAddress: emailState.walletAddress
            })
        });

        console.log('Welcome email sent to:', email);

    } catch (error) {
        console.error('Error sending welcome email:', error);
        // Don't show error to user, as subscription was successful
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        return false;
    }

    // Check for disposable email domains (optional)
    const disposableDomains = [
        'tempmail.com',
        'guerrillamail.com',
        '10minutemail.com',
        'throwaway.email',
        'mailinator.com'
    ];

    const domain = email.split('@')[1].toLowerCase();
    if (disposableDomains.includes(domain)) {
        appHelpers.showNotification(
            'Please use a permanent email address.',
            'error'
        );
        return false;
    }

    return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.emailHelpers = {
    showEmailCollectionModal,
    closeEmailModal,
    skipEmail,
    submitEmail
};

// Export functions used by HTML onclick handlers
window.showEmailCollectionModal = showEmailCollectionModal;
window.closeEmailModal = closeEmailModal;
window.skipEmail = skipEmail;
window.submitEmail = submitEmail;
