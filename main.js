// ═══════════════════════════════════════════════════════════════
// HVNA PRESALE LANDING PAGE - MAIN JAVASCRIPT
// ═══════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const appState = {
    phaseEndDate: null,
    exitIntentShown: false,
    scrollPosition: 0,
    currentPhase: {
        name: 'Genesis Founders',
        price: 0.001,
        tokensRemaining: null, // Will show "Ground Floor Opportunity" instead of fake numbers
        progress: null // Removed fake progress - showing real deadline instead
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INITIALIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

document.addEventListener('DOMContentLoaded', function() {
    console.log('🐘 Havana Elephant Presale - Initialized');

    // Initialize countdown timer - Phase ends July 9, 2026
    appState.phaseEndDate = new Date('2026-07-09T23:59:59');

    initializeCountdown();
    initializeInvestmentCalculator();
    initializeScrollEffects();
    initializeExitIntent();
    initializeActivityFeed();
    updatePhaseInfo();

    // Track page view
    trackEvent('page_view', {
        page_title: document.title,
        page_location: window.location.href
    });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COUNTDOWN TIMER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initializeCountdown() {
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function updateCountdown() {
    const now = new Date().getTime();
    const distance = appState.phaseEndDate - now;

    if (distance < 0) {
        // Countdown ended
        document.getElementById('main-countdown').innerHTML =
            '<div class="countdown-ended">Phase Ended</div>';
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Update main countdown
    document.getElementById('days').textContent = String(days).padStart(2, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');

    // Update header countdown (compact format)
    const headerCountdown = document.getElementById('header-countdown');
    if (headerCountdown) {
        headerCountdown.textContent = `${days}d ${hours}h ${minutes}m`;
    }

    // Update urgency countdown
    const urgencyCountdown = document.getElementById('urgency-countdown-display');
    if (urgencyCountdown) {
        urgencyCountdown.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    }

    // Update dashboard countdown
    const dashboardDays = document.getElementById('dashboard-days');
    const dashboardHours = document.getElementById('dashboard-hours');
    const dashboardMinutes = document.getElementById('dashboard-minutes');
    if (dashboardDays) dashboardDays.textContent = String(days).padStart(2, '0');
    if (dashboardHours) dashboardHours.textContent = String(hours).padStart(2, '0');
    if (dashboardMinutes) dashboardMinutes.textContent = String(minutes).padStart(2, '0');

    // Add urgent styling if less than 48 hours
    const totalHours = days * 24 + hours;
    if (totalHours < 48) {
        document.getElementById('main-countdown').classList.add('countdown-urgent');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INVESTMENT CALCULATOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initializeInvestmentCalculator() {
    const input = document.getElementById('investment-amount');
    if (input) {
        input.addEventListener('input', updateCalculator);
        // Set default value
        input.value = 1000;
        updateCalculator();
    }
}

function updateCalculator() {
    const usdAmount = parseFloat(document.getElementById('investment-amount').value) || 0;
    const currentPrice = 0.001; // $0.001 per token
    const launchPrice = 0.07; // $0.07 target

    const tokensReceived = Math.floor(usdAmount / currentPrice);
    const futureValue = tokensReceived * launchPrice;
    const percentGain = usdAmount > 0 ? ((futureValue - usdAmount) / usdAmount * 100).toFixed(0) : 0;

    // Update display
    document.getElementById('tokens-received').textContent =
        tokensReceived.toLocaleString('en-US');
    document.getElementById('future-value').textContent =
        '$' + futureValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('potential-gain').textContent =
        '+' + percentGain + '%';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCROLL EFFECTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initializeScrollEffects() {
    let lastScrollTop = 0;
    const stickyHeader = document.getElementById('sticky-header');

    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Show/hide sticky header
        if (scrollTop > 600) {
            stickyHeader.classList.remove('hidden');
        } else {
            stickyHeader.classList.add('hidden');
        }

        // Track scroll depth
        const scrollPercent = (scrollTop / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

        if (scrollPercent > 25 && !appState.scrollDepth25) {
            appState.scrollDepth25 = true;
            trackEvent('scroll_depth', { depth: 25 });
        }
        if (scrollPercent > 50 && !appState.scrollDepth50) {
            appState.scrollDepth50 = true;
            trackEvent('scroll_depth', { depth: 50 });
        }
        if (scrollPercent > 75 && !appState.scrollDepth75) {
            appState.scrollDepth75 = true;
            trackEvent('scroll_depth', { depth: 75 });
        }
        if (scrollPercent > 90 && !appState.scrollDepth100) {
            appState.scrollDepth100 = true;
            trackEvent('scroll_depth', { depth: 100 });
        }

        lastScrollTop = scrollTop;
    });

    // Fade in elements on scroll
    const fadeElements = document.querySelectorAll('.fade-in-on-scroll');
    if (fadeElements.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in');
                }
            });
        }, { threshold: 0.1 });

        fadeElements.forEach(el => observer.observe(el));
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXIT INTENT DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initializeExitIntent() {
    // Only on desktop
    if (window.innerWidth > 1023) {
        document.addEventListener('mouseout', function(e) {
            if (!e.toElement && !e.relatedTarget && !appState.exitIntentShown) {
                // Mouse left the window from the top
                if (e.clientY < 10) {
                    showExitIntentModal();
                }
            }
        });
    }
}

function showExitIntentModal() {
    appState.exitIntentShown = true;
    const modal = document.getElementById('exit-intent-modal');
    modal.classList.add('active');

    trackEvent('exit_intent_shown', {
        time_on_page: Date.now() - appState.pageLoadTime
    });
}

function closeExitModal() {
    const modal = document.getElementById('exit-intent-modal');
    modal.classList.remove('active');

    trackEvent('exit_intent_dismissed');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTIVITY FEED (SIMULATED)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initializeActivityFeed() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;

    // Simulated recent purchases
    const activities = [
        { address: '0x7a3f...9d2c', amount: 500, time: 12 },
        { address: '0x9e2c...4b8d', amount: 1200, time: 34 },
        { address: '0x4b8d...7f3a', amount: 150, time: 61 }
    ];

    activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.textContent = `• ${activity.address} bought $${activity.amount} of $HVNA (${activity.time} mins ago)`;
        activityList.appendChild(item);
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHASE INFO UPDATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function updatePhaseInfo() {
    // Update tokens remaining with honest messaging
    const tokensRemainingElements = document.querySelectorAll('#tokens-remaining, #urgency-tokens-remaining');
    tokensRemainingElements.forEach(el => {
        if (appState.currentPhase.tokensRemaining === null) {
            // BaseScan link temporarily removed during Genesis phase - restore when contract value >$5K
            // Original: el.innerHTML = '<a href="https://basescan.org/address/0x390Bdc27F8488915AC5De3fCd43c695b41f452FA" target="_blank" style="color: inherit; text-decoration: underline;">Verify on BaseScan →</a>';
            el.textContent = 'Available';
        } else {
            el.textContent = appState.currentPhase.tokensRemaining.toLocaleString('en-US');
        }
    });

    // Update progress percentage - hide if null
    const progressElement = document.getElementById('progress-percentage');
    if (progressElement) {
        if (appState.currentPhase.progress === null) {
            progressElement.parentElement.style.display = 'none';
        } else {
            progressElement.textContent = appState.currentPhase.progress;
        }
    }

    const progressFill = document.getElementById('phase-progress');
    if (progressFill) {
        if (appState.currentPhase.progress === null) {
            progressFill.parentElement.style.display = 'none';
        } else {
            progressFill.style.width = appState.currentPhase.progress + '%';
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAQ ACCORDION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function toggleFaq(button) {
    const faqItem = button.parentElement;
    const isActive = faqItem.classList.contains('active');

    // Close all FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
    });

    // Toggle current item
    if (!isActive) {
        faqItem.classList.add('active');

        trackEvent('faq_opened', {
            question: button.querySelector('span').textContent
        });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODAL MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function openPurchaseModal(location = 'unknown') {
    const modal = document.getElementById('purchase-modal');
    modal.classList.add('active');

    // Show wallet selection screen
    showModalScreen('modal-wallet-selection');

    trackEvent('buy_button_clicked', { location });
}

function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    modal.classList.remove('active');

    // Reset to wallet selection
    showModalScreen('modal-wallet-selection');
}

function showModalScreen(screenId) {
    document.querySelectorAll('.modal-screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PURCHASE FLOW (UI UPDATES)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setQuickAmount(amount) {
    const input = document.getElementById('usd-amount');
    if (input) {
        input.value = amount;
        updatePurchaseCalculation();

        trackEvent('quick_amount_clicked', { amount });
    }
}

function updatePurchaseCalculation() {
    const usdAmount = parseFloat(document.getElementById('usd-amount').value) || 0;
    const currentPrice = 0.001; // $0.001 per token
    var minUsd = (typeof CONSTANTS !== 'undefined') ? CONSTANTS.MIN_PURCHASE_USD : 10;

    const tokensReceived = Math.floor(usdAmount / currentPrice);

    // Update token displays
    var purchaseTokensEl = document.getElementById('purchase-tokens');
    var detailTokensEl = document.getElementById('detail-tokens');
    var buttonTokensEl = document.getElementById('button-tokens');
    var buttonAmountEl = document.getElementById('button-amount');
    if (purchaseTokensEl) purchaseTokensEl.textContent = tokensReceived.toLocaleString('en-US');
    if (detailTokensEl) detailTokensEl.textContent = tokensReceived.toLocaleString('en-US') + ' $HVNA';
    if (buttonTokensEl) buttonTokensEl.textContent = tokensReceived.toLocaleString('en-US');
    if (buttonAmountEl) buttonAmountEl.textContent = usdAmount.toFixed(2);

    // Show minimum purchase warning
    var minWarning = document.getElementById('min-purchase-warning');
    if (usdAmount > 0 && usdAmount < minUsd) {
        if (!minWarning) {
            minWarning = document.createElement('p');
            minWarning.id = 'min-purchase-warning';
            minWarning.style.cssText = 'color: #ff6b6b; font-size: 0.9em; margin: 8px 0 0; font-weight: 600;';
            var inputWrapper = document.getElementById('usd-amount').parentElement;
            inputWrapper.parentElement.appendChild(minWarning);
        }
        minWarning.textContent = 'Minimum purchase: 10,000 tokens ($' + minUsd + ')';
        minWarning.style.display = 'block';
    } else if (minWarning) {
        minWarning.style.display = 'none';
    }

    trackEvent('amount_entered', { amount: usdAmount });
}

// Initialize purchase form when it becomes visible
document.addEventListener('DOMContentLoaded', function() {
    const usdInput = document.getElementById('usd-amount');
    if (usdInput) {
        usdInput.addEventListener('input', updatePurchaseCalculation);
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INFO HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function showBaseInfo(event) {
    event.preventDefault();

    alert(`Base Network Information

Base is Ethereum's Layer 2 solution built by Coinbase. It offers:

✓ Lower transaction fees (typically <$0.01)
✓ Faster confirmation times (1-2 seconds)
✓ Full Ethereum security
✓ Easy bridging from Ethereum mainnet

Base is perfect for token presales because it keeps your costs low while maintaining the security of Ethereum.`);

    trackEvent('info_link_clicked', { type: 'what_is_base' });
}

function showAddBaseInfo(event) {
    event.preventDefault();

    alert(`How to Add Base Network to Your Wallet

For MetaMask:
1. Visit chainlist.org
2. Search for "Base"
3. Click "Add to MetaMask"
4. Approve in your wallet

Or we'll help you add it automatically when you connect your wallet!`);

    trackEvent('info_link_clicked', { type: 'how_to_add_base' });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYTICS TRACKING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function trackEvent(eventName, params = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, params);
    }

    // Console logging for development
    console.log('📊 Event:', eventName, params);
}

function trackConversion(amount, tokens, walletAddress) {
    trackEvent('purchase_success', {
        currency: 'USD',
        value: amount,
        token_amount: tokens,
        wallet: walletAddress.substring(0, 10) + '...'
    });
}

// Track time on page on unload
let pageLoadTime = Date.now();
appState.pageLoadTime = pageLoadTime;

window.addEventListener('beforeunload', function() {
    const timeOnPage = Math.floor((Date.now() - pageLoadTime) / 1000);
    trackEvent('time_on_page', {
        seconds: timeOnPage,
        bucket: timeOnPage < 30 ? '<30s' :
                timeOnPage < 60 ? '30-60s' :
                timeOnPage < 180 ? '1-3min' :
                timeOnPage < 300 ? '3-5min' : '5min+'
    });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatAddress(address) {
    if (!address) return '0x0000...0000';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

function formatNumber(num, decimals = 2) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function showNotification(message, type = 'info') {
    // Simple notification (could be enhanced with a toast library)
    alert(message);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ERROR HANDLING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    trackEvent('javascript_error', {
        message: event.error.message,
        stack: event.error.stack
    });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS (for use by web3.js and email-collection.js)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Brand Story Modal Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function openBrandStoryModal() {
    const modal = document.getElementById('brand-story-modal');
    if (modal) {
        modal.classList.add('active');
        // Scroll to top of modal content
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }

        // Track that user opened brand story
        trackEvent('brand_story_opened', { source: 'footer_link' });

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
}

function closeBrandStoryModal() {
    const modal = document.getElementById('brand-story-modal');
    if (modal) {
        modal.classList.remove('active');

        // Restore body scroll
        document.body.style.overflow = '';

        // Track modal close
        trackEvent('brand_story_closed');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  White Paper Modal Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function openWhitePaperModal() {
    const modal = document.getElementById('white-paper-modal');
    if (modal) {
        modal.classList.add('active');
        // Scroll to top of modal content
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }

        // Track that user opened white paper
        trackEvent('white_paper_opened', { source: 'footer_link' });

        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }
}

function closeWhitePaperModal() {
    const modal = document.getElementById('white-paper-modal');
    if (modal) {
        modal.classList.remove('active');

        // Restore body scroll
        document.body.style.overflow = '';

        // Track modal close
        trackEvent('white_paper_closed');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.appHelpers = {
    showModalScreen,
    formatAddress,
    formatNumber,
    trackEvent,
    trackConversion,
    showNotification
};

// Export functions used by HTML onclick handlers
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.toggleFaq = toggleFaq;
window.setQuickAmount = setQuickAmount;
window.showBaseInfo = showBaseInfo;
window.showAddBaseInfo = showAddBaseInfo;
window.closeExitModal = closeExitModal;
window.openBrandStoryModal = openBrandStoryModal;
window.closeBrandStoryModal = closeBrandStoryModal;
window.openWhitePaperModal = openWhitePaperModal;
window.closeWhitePaperModal = closeWhitePaperModal;
