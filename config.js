// ═══════════════════════════════════════════════════════════════
// HVNA PRESALE LANDING PAGE - CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NETWORK CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BASE_NETWORK_CONFIG = {
    chainId: 8453,
    chainIdHex: '0x2105',
    chainName: 'Base',
    nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org']
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTRACT CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// IMPORTANT: Replace these addresses with your actual deployed contract addresses
const PRESALE_CONTRACT_CONFIG = {
    address: '0x390Bdc27F8488915AC5De3fCd43c695b41f452FA', // Base mainnet presale contract (working address from havanaelephant.com)
    abi: [
        // Minimal ABI for presale contract
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "_tokenAmount",
                    "type": "uint256"
                }
            ],
            "name": "buyTokens",
            "outputs": [],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "inputs": [],
            "name": "getCurrentPhase",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "phase",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "price",
                    "type": "uint256"
                },
                {
                    "internalType": "uint256",
                    "name": "remaining",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "uint256",
                    "name": "ethAmount",
                    "type": "uint256"
                }
            ],
            "name": "getTokenAmount",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "anonymous": false,
            "inputs": [
                {
                    "indexed": true,
                    "internalType": "address",
                    "name": "buyer",
                    "type": "address"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "ethAmount",
                    "type": "uint256"
                },
                {
                    "indexed": false,
                    "internalType": "uint256",
                    "name": "tokenAmount",
                    "type": "uint256"
                }
            ],
            "name": "TokensPurchased",
            "type": "event"
        }
    ]
};

// Wrapper Contract (swaps stablecoins → ETH → presale in one tx)
const WRAPPER_CONTRACT_CONFIG = {
    address: '0x1bE0684a0B5C4141E6b39e063FEAe231EB22D3c0',
    abi: [
        {
            "inputs": [
                { "internalType": "address", "name": "stablecoin", "type": "address" },
                { "internalType": "uint256", "name": "stablecoinAmount", "type": "uint256" },
                { "internalType": "uint256", "name": "hvnaTokenAmount", "type": "uint256" },
                { "internalType": "uint256", "name": "minEthOut", "type": "uint256" }
            ],
            "name": "purchaseWithStablecoin",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                { "internalType": "address", "name": "stablecoin", "type": "address" },
                { "internalType": "uint256", "name": "stablecoinAmount", "type": "uint256" }
            ],
            "name": "getEstimatedEthOutput",
            "outputs": [
                { "internalType": "uint256", "name": "", "type": "uint256" }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ]
};

// Stablecoin Token Addresses on Base
const STABLECOIN_CONFIG = {
    USDT: {
        address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        icon: '/images/tokens/usdt.svg'
    },
    USDC: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        icon: '/images/tokens/usdc.svg'
    }
};

// Minimal ERC20 ABI for balance, approve, allowance
const ERC20_ABI = [
    {
        "inputs": [{ "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "spender", "type": "address" },
            { "name": "amount", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "name": "owner", "type": "address" },
            { "name": "spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{ "name": "", "type": "uint8" }],
        "stateMutability": "view",
        "type": "function"
    }
];

const TOKEN_CONTRACT_CONFIG = {
    address: '0xb5561d071b39221239a56f0379a6bb96c85fb94f', // Base mainnet HVNA token
    symbol: 'HVNA',
    decimals: 18,
    image: 'https://presale.havanaelephant.com/images/hvna-token.jpg', // $HVNA token image
    abi: [
        // Minimal ERC20 ABI
        {
            "constant": true,
            "inputs": [
                {
                    "name": "_owner",
                    "type": "address"
                }
            ],
            "name": "balanceOf",
            "outputs": [
                {
                    "name": "balance",
                    "type": "uint256"
                }
            ],
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "decimals",
            "outputs": [
                {
                    "name": "",
                    "type": "uint8"
                }
            ],
            "type": "function"
        },
        {
            "constant": true,
            "inputs": [],
            "name": "symbol",
            "outputs": [
                {
                    "name": "",
                    "type": "string"
                }
            ],
            "type": "function"
        }
    ]
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRESALE PHASES CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PRESALE_PHASES = [
    {
        name: 'Founder',
        priceUsd: 0.051,
        priceIncrease: '—',
        status: 'active',
        tokensAllocated: 5000000,
        endDate: null
    },
    {
        name: 'Public',
        priceUsd: 0.073,
        priceIncrease: 'early-supporter rate',
        status: 'upcoming',
        tokensAllocated: 10000000,
        endDate: null
    }
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const API_ENDPOINTS = {
    emailSubscribe: '/api/email-subscribe',
    sendWelcomeEmail: '/api/send-welcome-email',
    getPhaseInfo: '/api/phase-info',
    getExchangeRate: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCIAL LINKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SOCIAL_LINKS = {
    discord: 'https://discord.gg/hzfTpjgy4',
    telegram: 'https://t.me/havanaelephantbrand',
    twitter: 'https://twitter.com/havanaWeb3',
    linkedin: 'https://www.linkedin.com/in/davidjsime',
    whitepaper: '',
    website: 'https://havanaelephant.com'
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURE FLAGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FEATURES = {
    enableEmailCollection: true,
    enableExitIntent: true,
    enableActivityFeed: true,
    enableLiveStats: false, // Set to true when backend is ready
    testMode: false // Set to true for testing with testnet
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYTICS CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ANALYTICS_CONFIG = {
    googleAnalyticsId: 'GA_MEASUREMENT_ID', // REPLACE WITH ACTUAL GA4 ID
    enableTracking: true,
    debugMode: false
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONSTANTS = {
    MIN_PURCHASE_USD: 10,
    MAX_PURCHASE_USD: 100000,
    CURRENT_PHASE: 0,
    FUNDING_TARGET_EUR: 850000,
    CONTENTLYNK_BETA_SPOTS: 1000,
    CONTENTLYNK_BETA_REGISTERED: 470
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL TEMPLATES CONFIGURATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EMAIL_CONFIG = {
    fromEmail: 'hello@contentlynk.com',
    fromName: 'David Sime - Havana Elephant',
    replyTo: 'hello@contentlynk.com',
    welcomeEmailSubject: 'Welcome to the $HVNA Journey! 🐘',
    listTags: {
        allBuyers: 'Token-Buyer',
        seedRound: 'Seed-Round-Buyer',
        whale: 'Whale-Buyer', // $1000+
        regular: 'Regular-Buyer', // $100-999
        small: 'Small-Buyer', // <$100
        emailProvided: 'Email-Provided',
        optedIn: 'Opted-In-Post-Purchase'
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALIDATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Validate configuration on load
(function validateConfig() {
    if (PRESALE_CONTRACT_CONFIG.address === '0x0000000000000000000000000000000000000000') {
        console.warn('⚠️ PRESALE CONTRACT ADDRESS NOT SET - Update config.js before deployment!');
    }

    if (TOKEN_CONTRACT_CONFIG.address === '0x0000000000000000000000000000000000000000') {
        console.warn('⚠️ TOKEN CONTRACT ADDRESS NOT SET - Update config.js before deployment!');
    }

    if (ANALYTICS_CONFIG.googleAnalyticsId === 'GA_MEASUREMENT_ID') {
        console.warn('⚠️ GOOGLE ANALYTICS ID NOT SET - Update config.js to enable analytics!');
    }

    console.log('✅ Configuration loaded');
    console.log('Current phase:', PRESALE_PHASES[CONSTANTS.CURRENT_PHASE].name);
    console.log('Network:', BASE_NETWORK_CONFIG.chainName);
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Make configuration available globally
window.CONFIG = {
    BASE_NETWORK_CONFIG,
    PRESALE_CONTRACT_CONFIG,
    WRAPPER_CONTRACT_CONFIG,
    STABLECOIN_CONFIG,
    ERC20_ABI,
    TOKEN_CONTRACT_CONFIG,
    PRESALE_PHASES,
    API_ENDPOINTS,
    SOCIAL_LINKS,
    FEATURES,
    ANALYTICS_CONFIG,
    CONSTANTS,
    EMAIL_CONFIG
};

// Export individual variables for backward compatibility with web3.js
window.BASE_NETWORK_CONFIG = BASE_NETWORK_CONFIG;
window.PRESALE_CONTRACT_CONFIG = PRESALE_CONTRACT_CONFIG;
window.WRAPPER_CONTRACT_CONFIG = WRAPPER_CONTRACT_CONFIG;
window.STABLECOIN_CONFIG = STABLECOIN_CONFIG;
window.ERC20_ABI = ERC20_ABI;
window.TOKEN_CONTRACT_CONFIG = TOKEN_CONTRACT_CONFIG;
window.PRESALE_PHASES = PRESALE_PHASES;
window.API_ENDPOINTS = API_ENDPOINTS;
window.SOCIAL_LINKS = SOCIAL_LINKS;
window.FEATURES = FEATURES;
window.ANALYTICS_CONFIG = ANALYTICS_CONFIG;
window.CONSTANTS = CONSTANTS;
window.EMAIL_CONFIG = EMAIL_CONFIG;
