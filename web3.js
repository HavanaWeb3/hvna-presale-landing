// ═══════════════════════════════════════════════════════════════
// HVNA PRESALE LANDING PAGE - WEB3 INTEGRATION
// ═══════════════════════════════════════════════════════════════

// This file requires ethers.js to be loaded
// Add to HTML: <script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEB3 STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const web3State = {
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    balance: null,
    presaleContract: null,
    tokenContract: null,
    wrapperContract: null,
    selectedToken: 'ETH',
    stablecoinBalances: { USDT: '0', USDC: '0' },
    stablecoinApproved: { USDT: false, USDC: false }
};

// EUR to ETH exchange rate (should be fetched from API)
let eurToEthRate = 0.00029; // Example: 1 EUR = 0.00029 ETH (update dynamically)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOBILE WALLET DETECTION (RETRY LOGIC)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Mobile wallets (MetaMask, Trust Wallet, Coinbase) inject window.ethereum
// with a delay in their in-app browsers. This retries detection to handle that.
function detectWalletWithRetry(maxAttempts, interval) {
    if (maxAttempts === undefined) maxAttempts = 20;
    if (interval === undefined) interval = 500;
    return new Promise(function(resolve) {
        var attempts = 0;

        function check() {
            if (window.ethereum) {
                console.log('Wallet detected on attempt ' + (attempts + 1));
                resolve(window.ethereum);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, interval);
            } else {
                console.log('No wallet detected after ' + maxAttempts + ' attempts');
                resolve(null);
            }
        }

        check();
    });
}

function isMobileDevice() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function showMobileWalletGuidance() {
    var msg = 'No wallet detected.\n\n' +
        'To connect your wallet on mobile:\n\n' +
        '1. Open your wallet app (MetaMask, Trust Wallet, or Coinbase Wallet)\n' +
        '2. Find the built-in Browser\n' +
        '3. Navigate to: presale.havanaelephant.com\n' +
        '4. Tap Connect Wallet\n\n' +
        'This ensures the wallet can communicate with the site.';
    alert(msg);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET CONNECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function connectWallet(walletType) {
    try {
        appHelpers.trackEvent('wallet_connect_initiated', { wallet_type: walletType });

        let provider;

        switch (walletType) {
            case 'metamask':
            case 'rabby':
            case 'coinbase': {
                // Use retry logic: mobile wallets inject ethereum with a delay
                var ethereum = await detectWalletWithRetry(10, 300);
                if (!ethereum) {
                    if (isMobileDevice()) {
                        showMobileWalletGuidance();
                        appHelpers.trackEvent('wallet_connection_failed', {
                            wallet_type: walletType,
                            error: 'no_wallet_mobile'
                        });
                        return;
                    }
                    var walletNames = { metamask: 'MetaMask', rabby: 'Rabby', coinbase: 'Coinbase Wallet' };
                    throw new Error((walletNames[walletType] || 'Wallet') + ' is not installed. Please install it to continue.');
                }
                provider = new ethers.providers.Web3Provider(ethereum);
                await ethereum.request({ method: 'eth_requestAccounts' });
                break;
            }

            case 'walletconnect':
                // WalletConnect integration planned for future release
                alert('WalletConnect support is coming soon.\n\nFor now, please open this page directly in your wallet app\'s built-in browser to connect.');
                appHelpers.trackEvent('wallet_connection_failed', {
                    wallet_type: walletType,
                    error: 'WalletConnect not yet implemented'
                });
                return;

            default:
                throw new Error('Unsupported wallet type');
        }

        web3State.provider = provider;
        web3State.signer = provider.getSigner();
        web3State.address = await web3State.signer.getAddress();

        // Get chain ID
        const network = await provider.getNetwork();
        web3State.chainId = network.chainId;

        appHelpers.trackEvent('wallet_connected_success', {
            wallet_type: walletType,
            chain_id: web3State.chainId,
            address: web3State.address.substring(0, 10) + '...'
        });

        // Check if on correct network
        if (web3State.chainId !== BASE_NETWORK_CONFIG.chainId) {
            await switchToBaseNetwork();
        } else {
            await onWalletConnected();
        }

    } catch (error) {
        console.error('Wallet connection error:', error);
        appHelpers.showNotification(error.message, 'error');

        appHelpers.trackEvent('wallet_connection_failed', {
            wallet_type: walletType,
            error: error.message
        });
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NETWORK MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function switchToBaseNetwork() {
    try {
        appHelpers.trackEvent('network_switch_initiated');

        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_NETWORK_CONFIG.chainIdHex }],
        });

        appHelpers.trackEvent('network_switch_success');
        await onWalletConnected();

    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [BASE_NETWORK_CONFIG],
                });

                appHelpers.trackEvent('network_added_success');
                await onWalletConnected();

            } catch (addError) {
                console.error('Error adding network:', addError);
                appHelpers.showNotification('Failed to add Base network to your wallet.', 'error');

                appHelpers.trackEvent('network_add_failed', {
                    error: addError.message
                });
            }
        } else {
            console.error('Error switching network:', switchError);
            appHelpers.showNotification('Please switch to Base network in your wallet.', 'error');

            appHelpers.trackEvent('network_switch_failed', {
                error: switchError.message
            });
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST-CONNECTION SETUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function onWalletConnected() {
    try {
        // Verify configuration is loaded
        if (typeof PRESALE_CONTRACT_CONFIG === 'undefined') {
            throw new Error('Configuration not loaded. Please refresh the page.');
        }

        // Get balance
        const balance = await web3State.provider.getBalance(web3State.address);
        web3State.balance = ethers.utils.formatEther(balance);

        // Initialize contracts
        web3State.presaleContract = new ethers.Contract(
            PRESALE_CONTRACT_CONFIG.address,
            PRESALE_CONTRACT_CONFIG.abi,
            web3State.signer
        );

        web3State.tokenContract = new ethers.Contract(
            TOKEN_CONTRACT_CONFIG.address,
            TOKEN_CONTRACT_CONFIG.abi,
            web3State.signer
        );

        // Initialize wrapper contract
        web3State.wrapperContract = new ethers.Contract(
            WRAPPER_CONTRACT_CONFIG.address,
            WRAPPER_CONTRACT_CONFIG.abi,
            web3State.signer
        );

        // Update UI
        updateWalletUI();

        // Show purchase form
        appHelpers.showModalScreen('modal-purchase-form');

        // Fetch live exchange rate
        await updateExchangeRate();

        // Fetch stablecoin balances and approvals in parallel
        fetchStablecoinBalances();
        checkStablecoinApproval('USDT');
        checkStablecoinApproval('USDC');

    } catch (error) {
        console.error('Post-connection setup error:', error);
        const errorMsg = error.message || 'Error setting up wallet connection. Please try again.';
        appHelpers.showNotification(errorMsg, 'error');
    }
}

function updateWalletUI() {
    // Update connected address
    const connectedAddress = document.getElementById('connected-address');
    if (connectedAddress) {
        connectedAddress.textContent = appHelpers.formatAddress(web3State.address);
    }

    // Update balance display based on selected token
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const walletBalance = document.getElementById('wallet-balance');
    const walletBalanceSymbol = document.getElementById('wallet-balance-symbol');
    if (!walletBalance) return;

    const token = web3State.selectedToken;
    if (token === 'ETH') {
        walletBalance.textContent = parseFloat(web3State.balance || 0).toFixed(4);
        if (walletBalanceSymbol) walletBalanceSymbol.textContent = 'ETH';
    } else {
        const bal = web3State.stablecoinBalances[token] || '0';
        walletBalance.textContent = parseFloat(bal).toFixed(2);
        if (walletBalanceSymbol) walletBalanceSymbol.textContent = token;
    }

    // Update per-card balances
    const ethBalEl = document.getElementById('balance-ETH');
    if (ethBalEl) ethBalEl.textContent = parseFloat(web3State.balance || 0).toFixed(4) + ' ETH';
    const usdtBalEl = document.getElementById('balance-USDT');
    if (usdtBalEl) usdtBalEl.textContent = parseFloat(web3State.stablecoinBalances.USDT || 0).toFixed(2) + ' USDT';
    const usdcBalEl = document.getElementById('balance-USDC');
    if (usdcBalEl) usdcBalEl.textContent = parseFloat(web3State.stablecoinBalances.USDC || 0).toFixed(2) + ' USDC';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYMENT TOKEN SELECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function selectPaymentToken(token) {
    web3State.selectedToken = token;

    // Update card selection UI
    document.querySelectorAll('.token-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.getElementById('token-card-' + token);
    if (selectedCard) selectedCard.classList.add('selected');

    // Show/hide stablecoin explainer
    const explainer = document.getElementById('stablecoin-explainer');
    if (explainer) {
        explainer.style.display = (token === 'USDT' || token === 'USDC') ? 'block' : 'none';
        // Update token name in explainer
        explainer.querySelectorAll('.selected-token-name').forEach(el => el.textContent = token);
    }

    // Update cost label
    const costLabel = document.getElementById('detail-cost-label');
    if (costLabel) {
        costLabel.textContent = token === 'ETH' ? 'ETH equivalent:' : token + ' equivalent:';
    }

    // Show/hide approve button
    updateApprovalUI();

    // Update balance display
    updateBalanceDisplay();

    // Recalculate purchase details
    updatePurchaseDetails();

    appHelpers.trackEvent('payment_token_selected', { token: token });
}

function updateApprovalUI() {
    const token = web3State.selectedToken;
    const approveBtn = document.getElementById('approve-button');
    const purchaseBtn = document.getElementById('purchase-button');
    const approveTokenName = document.getElementById('approve-token-name');

    if (!approveBtn || !purchaseBtn) return;

    if ((token === 'USDT' || token === 'USDC') && !web3State.stablecoinApproved[token]) {
        approveBtn.style.display = 'block';
        purchaseBtn.style.display = 'none';
        if (approveTokenName) approveTokenName.textContent = token;
    } else {
        approveBtn.style.display = 'none';
        purchaseBtn.style.display = 'block';
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STABLECOIN BALANCE & APPROVAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function fetchStablecoinBalances() {
    if (!web3State.signer || !web3State.address) return;

    for (const symbol of ['USDT', 'USDC']) {
        try {
            const config = STABLECOIN_CONFIG[symbol];
            const contract = new ethers.Contract(config.address, ERC20_ABI, web3State.signer);
            const balance = await contract.balanceOf(web3State.address);
            web3State.stablecoinBalances[symbol] = ethers.utils.formatUnits(balance, config.decimals);
        } catch (error) {
            console.warn('Failed to fetch ' + symbol + ' balance:', error);
            web3State.stablecoinBalances[symbol] = '0';
        }
    }

    updateBalanceDisplay();
}

async function checkStablecoinApproval(symbol) {
    if (!web3State.signer || !web3State.address) return;

    try {
        const config = STABLECOIN_CONFIG[symbol];
        const contract = new ethers.Contract(config.address, ERC20_ABI, web3State.signer);
        const allowance = await contract.allowance(web3State.address, WRAPPER_CONTRACT_CONFIG.address);
        // Consider approved if allowance > 1000 tokens (sufficient for most purchases)
        const threshold = ethers.utils.parseUnits('1000', config.decimals);
        web3State.stablecoinApproved[symbol] = allowance.gte(threshold);
    } catch (error) {
        console.warn('Failed to check ' + symbol + ' approval:', error);
        web3State.stablecoinApproved[symbol] = false;
    }

    updateApprovalUI();
}

async function approveStablecoin() {
    const symbol = web3State.selectedToken;
    if (symbol !== 'USDT' && symbol !== 'USDC') return;

    const config = STABLECOIN_CONFIG[symbol];
    const approveBtn = document.getElementById('approve-button');
    const originalText = approveBtn.textContent;

    try {
        approveBtn.disabled = true;
        approveBtn.textContent = 'Waiting for wallet confirmation...';

        const contract = new ethers.Contract(config.address, ERC20_ABI, web3State.signer);
        // Approve max uint256
        const maxApproval = ethers.constants.MaxUint256;
        const tx = await contract.approve(WRAPPER_CONTRACT_CONFIG.address, maxApproval);

        approveBtn.textContent = 'Approving on blockchain...';
        await tx.wait();

        web3State.stablecoinApproved[symbol] = true;
        updateApprovalUI();

        appHelpers.showNotification(symbol + ' approved successfully!', 'success');
        appHelpers.trackEvent('stablecoin_approved', { token: symbol, tx_hash: tx.hash });

    } catch (error) {
        console.error('Approval error:', error);
        if (error.code === 4001) {
            appHelpers.showNotification('Approval cancelled by user.', 'error');
        } else {
            appHelpers.showNotification('Failed to approve ' + symbol + '. Please try again.', 'error');
        }
        appHelpers.trackEvent('stablecoin_approval_failed', { token: symbol, error: error.message });
    } finally {
        approveBtn.disabled = false;
        approveBtn.textContent = originalText;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STABLECOIN PURCHASE VIA WRAPPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function purchaseWithStablecoin(eurAmount) {
    const symbol = web3State.selectedToken;
    const config = STABLECOIN_CONFIG[symbol];

    // Convert EUR to stablecoin amount (1:1 for USD stablecoins, approximate)
    // EUR to USD: use a rough 1.08 conversion (could be fetched live)
    const eurToUsd = 1.08;
    const usdAmount = eurAmount * eurToUsd;
    const stablecoinAmount = ethers.utils.parseUnits(usdAmount.toFixed(config.decimals > 2 ? 2 : config.decimals), config.decimals);

    const currentTokenPrice = 0.01;
    const tokensReceived = Math.floor(eurAmount / currentTokenPrice);
    const hvnaTokenAmount = ethers.utils.parseEther(tokensReceived.toString());

    const button = document.getElementById('purchase-button');
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = 'Waiting for wallet confirmation...';

        appHelpers.trackEvent('stablecoin_purchase_initiated', {
            token: symbol,
            amount_eur: eurAmount,
            stablecoin_amount: usdAmount
        });

        // Call wrapper contract
        const wrapperContract = new ethers.Contract(
            WRAPPER_CONTRACT_CONFIG.address,
            WRAPPER_CONTRACT_CONFIG.abi,
            web3State.signer
        );

        const tx = await wrapperContract.purchaseWithStablecoin(
            config.address,
            stablecoinAmount,
            hvnaTokenAmount,
            0, // minEthOut = 0 (accept any slippage for now)
            { gasLimit: 500000 }
        );

        button.textContent = 'Processing on blockchain...';
        const receipt = await tx.wait();

        console.log('Stablecoin purchase successful:', receipt);

        // Update success screen
        document.getElementById('success-tokens').textContent = tokensReceived.toLocaleString('en-US');
        document.getElementById('success-wallet').textContent = appHelpers.formatAddress(web3State.address);
        document.getElementById('success-amount').textContent = '€' + eurAmount.toFixed(2) + ' (' + usdAmount.toFixed(2) + ' ' + symbol + ')';
        document.getElementById('success-token-amount').textContent = tokensReceived.toLocaleString('en-US') + ' $HVNA';

        const txLink = document.getElementById('tx-link');
        txLink.href = 'https://basescan.org/tx/' + tx.hash;
        txLink.textContent = tx.hash.substring(0, 10) + '...' + tx.hash.substring(tx.hash.length - 8);

        appHelpers.trackConversion(eurAmount, tokensReceived, web3State.address);
        appHelpers.trackEvent('stablecoin_purchase_success', {
            token: symbol,
            tx_hash: tx.hash,
            amount_eur: eurAmount,
            tokens: tokensReceived
        });

        appHelpers.showModalScreen('modal-success');

        setTimeout(() => {
            showEmailCollectionModal(eurAmount, tokensReceived, tx.hash);
        }, 2000);

        // Refresh balances
        await fetchStablecoinBalances();

    } catch (error) {
        console.error('Stablecoin purchase error:', error);

        let errorMessage = 'Transaction failed. Please try again.';
        if (error.code === 4001) {
            errorMessage = 'Transaction cancelled by user.';
        } else if (error.message && error.message.includes('insufficient')) {
            errorMessage = 'Insufficient ' + symbol + ' balance.';
        }

        appHelpers.showNotification(errorMessage, 'error');
        appHelpers.trackEvent('stablecoin_purchase_failed', { token: symbol, error: error.message });
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        updatePurchaseDetails();
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXCHANGE RATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function updateExchangeRate() {
    try {
        // Fetch from CoinGecko API
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur'
        );
        const data = await response.json();

        if (data.ethereum && data.ethereum.eur) {
            const ethPriceInEur = data.ethereum.eur;
            eurToEthRate = 1 / ethPriceInEur;
            console.log('Exchange rate updated:', eurToEthRate, 'ETH per EUR');
        }
    } catch (error) {
        console.warn('Failed to fetch exchange rate, using default:', error);
        // Keep using the default rate
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PURCHASE CALCULATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Listen for EUR amount changes
document.addEventListener('DOMContentLoaded', function() {
    const eurInput = document.getElementById('eur-amount');
    if (eurInput) {
        eurInput.addEventListener('input', updatePurchaseDetails);
    }
});

async function updatePurchaseDetails() {
    const eurInput = document.getElementById('eur-amount');
    if (!eurInput) return;

    const eurAmount = parseFloat(eurInput.value) || 0;

    if (eurAmount === 0) {
        return;
    }

    const currentTokenPrice = 0.01; // €0.01 per token
    const tokensReceived = Math.floor(eurAmount / currentTokenPrice);
    const ethAmount = eurAmount * eurToEthRate;

    // Estimate gas
    let gasEstimate = 0.0001; // Default estimate
    try {
        if (web3State.presaleContract && web3State.address) {
            const ethValue = ethers.utils.parseEther(ethAmount.toFixed(18));
            const tokenAmountWithDecimals = ethers.utils.parseEther(tokensReceived.toString());

            const gasLimit = await web3State.presaleContract.estimateGas.buyTokens(
                tokenAmountWithDecimals,
                {
                    value: ethValue
                }
            );
            const gasPrice = await web3State.provider.getGasPrice();
            gasEstimate = parseFloat(ethers.utils.formatEther(gasLimit.mul(gasPrice)));
        }
    } catch (error) {
        console.warn('Gas estimation failed, using default:', error);
    }

    const gasCostEur = gasEstimate / eurToEthRate;
    const totalEth = ethAmount + gasEstimate;
    const totalEur = eurAmount + gasCostEur;

    // Update UI - with safety checks
    const detailEth = document.getElementById('detail-eth');
    const detailGas = document.getElementById('detail-gas');
    const detailTotal = document.getElementById('detail-total');
    const purchaseButton = document.getElementById('purchase-button');

    const selectedToken = web3State.selectedToken;

    if (selectedToken === 'USDT' || selectedToken === 'USDC') {
        // Stablecoin mode: show USD equivalent
        const eurToUsd = 1.08;
        const usdAmount = eurAmount * eurToUsd;

        if (detailEth) {
            detailEth.textContent = `${usdAmount.toFixed(2)} ${selectedToken} (~€${eurAmount.toFixed(2)})`;
        }
        if (detailGas) {
            detailGas.textContent = `~${gasEstimate.toFixed(6)} ETH (~€${gasCostEur.toFixed(2)})`;
        }
        if (detailTotal) {
            detailTotal.textContent = `~${usdAmount.toFixed(2)} ${selectedToken} + gas (~€${totalEur.toFixed(2)})`;
        }

        // Check stablecoin balance
        if (purchaseButton) {
            const stableBal = parseFloat(web3State.stablecoinBalances[selectedToken] || 0);
            if (stableBal < usdAmount) {
                purchaseButton.disabled = true;
                purchaseButton.textContent = 'Insufficient ' + selectedToken + ' Balance';
            } else {
                purchaseButton.disabled = false;
                purchaseButton.textContent = `Buy ${tokensReceived.toLocaleString('en-US')} $HVNA for ~${usdAmount.toFixed(2)} ${selectedToken}`;
            }
        }
    } else {
        // ETH mode
        if (detailEth) {
            detailEth.textContent = `${ethAmount.toFixed(6)} ETH (~€${eurAmount.toFixed(2)})`;
        }
        if (detailGas) {
            detailGas.textContent = `~${gasEstimate.toFixed(6)} ETH (~€${gasCostEur.toFixed(2)})`;
        }
        if (detailTotal) {
            detailTotal.textContent = `~${totalEth.toFixed(6)} ETH (~€${totalEur.toFixed(2)})`;
        }

        // Check ETH balance
        if (purchaseButton) {
            if (web3State.balance && parseFloat(web3State.balance) < totalEth) {
                purchaseButton.disabled = true;
                purchaseButton.textContent = 'Insufficient ETH Balance';
            } else {
                purchaseButton.disabled = false;
                purchaseButton.textContent = `Buy ${tokensReceived.toLocaleString('en-US')} $HVNA for ~€${eurAmount.toFixed(2)}`;
            }
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXECUTE PURCHASE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executePurchase() {
    const eurAmount = parseFloat(document.getElementById('eur-amount').value) || 0;

    if (eurAmount === 0) {
        appHelpers.showNotification('Please enter an amount.', 'error');
        return;
    }

    if (eurAmount < 10) {
        appHelpers.showNotification('Minimum purchase is €10.', 'error');
        return;
    }

    // Route to stablecoin purchase if USDT or USDC selected
    if (web3State.selectedToken === 'USDT' || web3State.selectedToken === 'USDC') {
        return purchaseWithStablecoin(eurAmount);
    }

    try {
        appHelpers.trackEvent('purchase_initiated', {
            amount_eur: eurAmount
        });

        const currentTokenPrice = 0.01;
        const tokensReceived = Math.floor(eurAmount / currentTokenPrice);
        const ethAmount = eurAmount * eurToEthRate;
        const ethValue = ethers.utils.parseEther(ethAmount.toFixed(18));

        // Disable button and show loading
        const button = document.getElementById('purchase-button');
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Waiting for wallet confirmation...';

        // Execute transaction - pass token amount with 18 decimals
        const tokenAmountWithDecimals = ethers.utils.parseEther(tokensReceived.toString());

        const tx = await web3State.presaleContract.buyTokens(tokenAmountWithDecimals, {
            value: ethValue,
            gasLimit: 300000 // Set a reasonable gas limit
        });

        button.textContent = 'Processing on blockchain...';

        appHelpers.trackEvent('transaction_confirmed', {
            tx_hash: tx.hash,
            amount_eur: eurAmount,
            tokens: tokensReceived
        });

        // Wait for confirmation
        const receipt = await tx.wait();

        console.log('Transaction successful:', receipt);

        // Update success screen
        document.getElementById('success-tokens').textContent =
            tokensReceived.toLocaleString('en-US');
        document.getElementById('success-wallet').textContent =
            appHelpers.formatAddress(web3State.address);
        document.getElementById('success-amount').textContent =
            '€' + eurAmount.toFixed(2);
        document.getElementById('success-token-amount').textContent =
            tokensReceived.toLocaleString('en-US') + ' $HVNA';

        // Set transaction link
        const txLink = document.getElementById('tx-link');
        txLink.href = `https://basescan.org/tx/${tx.hash}`;
        txLink.textContent = tx.hash.substring(0, 10) + '...' + tx.hash.substring(tx.hash.length - 8);

        // Track conversion
        appHelpers.trackConversion(eurAmount, tokensReceived, web3State.address);

        appHelpers.trackEvent('purchase_success', {
            tx_hash: tx.hash,
            amount_eur: eurAmount,
            tokens: tokensReceived,
            wallet: web3State.address
        });

        // Show success screen
        appHelpers.showModalScreen('modal-success');

        // Show email collection modal after 2 seconds
        setTimeout(() => {
            showEmailCollectionModal(eurAmount, tokensReceived, tx.hash);
        }, 2000);

        // Re-enable button
        button.disabled = false;
        button.textContent = originalText;

    } catch (error) {
        console.error('Purchase error:', error);

        let errorMessage = 'Transaction failed. Please try again.';

        if (error.code === 4001) {
            errorMessage = 'Transaction cancelled by user.';
        } else if (error.code === -32603) {
            errorMessage = 'Insufficient funds or gas estimation failed.';
        }

        appHelpers.showNotification(errorMessage, 'error');

        appHelpers.trackEvent('purchase_failed', {
            error: error.message,
            error_code: error.code
        });

        // Re-enable button
        const button = document.getElementById('purchase-button');
        button.disabled = false;
        updatePurchaseDetails(); // Reset button text
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADD TOKEN TO WALLET
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function addTokenToWallet() {
    try {
        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: TOKEN_CONTRACT_CONFIG.address,
                    symbol: TOKEN_CONTRACT_CONFIG.symbol,
                    decimals: TOKEN_CONTRACT_CONFIG.decimals,
                    image: TOKEN_CONTRACT_CONFIG.image,
                },
            },
        });

        if (wasAdded) {
            appHelpers.showNotification('$HVNA token added to your wallet!', 'success');
            appHelpers.trackEvent('token_added_to_wallet');
        }
    } catch (error) {
        console.error('Error adding token:', error);
        appHelpers.showNotification('Failed to add token to wallet.', 'error');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET EVENT LISTENERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Register wallet event listeners.
// On mobile, ethereum may not exist yet at script load time,
// so we set up listeners once it becomes available.
function registerWalletEventListeners(ethereum) {
    if (!ethereum || ethereum._hvnaListenersRegistered) return;
    ethereum._hvnaListenersRegistered = true;

    ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
            web3State.address = null;
            web3State.signer = null;
            appHelpers.trackEvent('wallet_disconnected');
        } else {
            web3State.address = accounts[0];
            appHelpers.trackEvent('wallet_account_changed', {
                new_address: web3State.address.substring(0, 10) + '...'
            });
            onWalletConnected();
        }
    });

    ethereum.on('chainChanged', function (chainId) {
        web3State.chainId = parseInt(chainId, 16);
        appHelpers.trackEvent('wallet_chain_changed', {
            chain_id: web3State.chainId
        });
        window.location.reload();
    });
}

// Register immediately if ethereum is already available
if (typeof window.ethereum !== 'undefined') {
    registerWalletEventListeners(window.ethereum);
}

// Also listen for the EIP-6963 / late-injection event (covers mobile wallets)
window.addEventListener('ethereum#initialized', function () {
    registerWalletEventListeners(window.ethereum);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.web3Helpers = {
    connectWallet,
    executePurchase,
    addTokenToWallet,
    selectPaymentToken,
    approveStablecoin,
    web3State
};
