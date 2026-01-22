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
    tokenContract: null
};

// EUR to ETH exchange rate (should be fetched from API)
let eurToEthRate = 0.00029; // Example: 1 EUR = 0.00029 ETH (update dynamically)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WALLET CONNECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function connectWallet(walletType) {
    try {
        appHelpers.trackEvent('wallet_connect_initiated', { wallet_type: walletType });

        let provider;

        switch (walletType) {
            case 'metamask':
                if (typeof window.ethereum === 'undefined') {
                    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
                }
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                break;

            case 'rabby':
                if (typeof window.ethereum === 'undefined') {
                    throw new Error('Rabby is not installed. Please install Rabby wallet to continue.');
                }
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                break;

            case 'coinbase':
                if (typeof window.ethereum === 'undefined') {
                    throw new Error('Coinbase Wallet is not installed.');
                }
                provider = new ethers.providers.Web3Provider(window.ethereum);
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                break;

            case 'walletconnect':
                // WalletConnect integration would require additional library
                // For now, show instructions
                alert('Please use the WalletConnect option in your mobile wallet app to scan a QR code. This feature requires additional setup.');
                appHelpers.trackEvent('wallet_connection_failed', {
                    wallet_type: walletType,
                    error: 'WalletConnect not implemented'
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

        // Update UI
        updateWalletUI();

        // Show purchase form
        appHelpers.showModalScreen('modal-purchase-form');

        // Fetch live exchange rate
        await updateExchangeRate();

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

    // Update balance
    const walletBalance = document.getElementById('wallet-balance');
    if (walletBalance) {
        walletBalance.textContent = parseFloat(web3State.balance).toFixed(4);
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

    if (detailEth) {
        detailEth.textContent = `${ethAmount.toFixed(6)} ETH (~€${eurAmount.toFixed(2)})`;
    }
    if (detailGas) {
        detailGas.textContent = `~${gasEstimate.toFixed(6)} ETH (~€${gasCostEur.toFixed(2)})`;
    }
    if (detailTotal) {
        detailTotal.textContent = `~${totalEth.toFixed(6)} ETH (~€${totalEur.toFixed(2)})`;
    }

    // Check if user has enough balance
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

if (typeof window.ethereum !== 'undefined') {
    // Account changed
    window.ethereum.on('accountsChanged', function (accounts) {
        if (accounts.length === 0) {
            // User disconnected wallet
            web3State.address = null;
            web3State.signer = null;
            appHelpers.trackEvent('wallet_disconnected');
        } else {
            // User switched account
            web3State.address = accounts[0];
            appHelpers.trackEvent('wallet_account_changed', {
                new_address: web3State.address.substring(0, 10) + '...'
            });
            onWalletConnected();
        }
    });

    // Chain changed
    window.ethereum.on('chainChanged', function (chainId) {
        web3State.chainId = parseInt(chainId, 16);
        appHelpers.trackEvent('wallet_chain_changed', {
            chain_id: web3State.chainId
        });

        // Reload page on chain change (recommended by MetaMask)
        window.location.reload();
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.web3Helpers = {
    connectWallet,
    executePurchase,
    addTokenToWallet,
    web3State
};
