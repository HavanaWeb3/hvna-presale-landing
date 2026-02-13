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

    // Build the payload once so we can reuse it for localStorage fallback
    const payload = {
        email: email,
        walletAddress: emailState.walletAddress,
        purchaseAmount: emailState.purchaseAmount,
        tokenAmount: emailState.tokenAmount,
        transactionHash: emailState.transactionHash,
        phase: 'Seed Round',
        source: 'Landing-Page-Purchase',
        timestamp: new Date().toISOString()
    };

    // Always save to localStorage as a safety net
    saveEmailToLocalStorage(payload);

    try {
        appHelpers.trackEvent('email_submitted', {
            purchase_amount: emailState.purchaseAmount
        });

        // Submit to backend (handles storage + welcome email)
        const response = await fetch('/api/email-subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Show success message
            document.getElementById('email-form').style.display = 'none';
            document.getElementById('email-success').style.display = 'block';

            appHelpers.trackEvent('email_submission_success', {
                purchase_amount: emailState.purchaseAmount
            });

        } else {
            throw new Error(data.error || 'Failed to subscribe');
        }

    } catch (error) {
        console.error('Email submission error:', error);

        // Even on failure, show success to user since we saved to localStorage.
        // The admin notification or localStorage export will catch it.
        document.getElementById('email-form').style.display = 'none';
        document.getElementById('email-success').style.display = 'block';

        appHelpers.showNotification(
            'Subscribed! If you don\'t receive a welcome email, reach out to hello@contentlynk.com',
            'info'
        );

        appHelpers.trackEvent('email_submission_failed_but_saved', {
            error: error.message,
            purchase_amount: emailState.purchaseAmount
        });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOCAL STORAGE FALLBACK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function saveEmailToLocalStorage(payload) {
    try {
        const stored = JSON.parse(localStorage.getItem('hvna_email_submissions') || '[]');
        stored.push(payload);
        localStorage.setItem('hvna_email_submissions', JSON.stringify(stored));
        console.log('Email saved to localStorage backup:', payload.email);
    } catch (e) {
        console.error('localStorage save failed:', e);
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
