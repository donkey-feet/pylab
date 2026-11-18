// Import configuration
import { BUNGIE_API_KEY, CLIENT_ID, REDIRECT_URL } from './config.js';

// Global variables
let currentUser = null;
let inventoryData = [];
// These will be set from config.js
let bungieApiKey = BUNGIE_API_KEY;
let clientId = CLIENT_ID;
let redirectUrl = REDIRECT_URL;

// Add error handling for missing configuration
if (!clientId || !redirectUrl) {
    console.error('Missing Bungie API configuration. Please check your config.js file.');
    alert('Configuration error: Missing Bungie API credentials. Please check the console for details.');
}

// DOM Elements
const loginSection = document.getElementById('login-section');
const inventorySection = document.getElementById('inventory-section');
const loadingSection = document.getElementById('loading-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const usernameSpan = document.getElementById('username');
const inventoryItems = document.getElementById('inventory-items');
const itemTypeFilter = document.getElementById('item-type-filter');
const itemTierFilter = document.getElementById('item-tier-filter');

// Event Listeners
loginBtn.addEventListener('click', handleLogin);
logoutBtn.addEventListener('click', handleLogout);
itemTypeFilter.addEventListener('change', filterInventory);
itemTierFilter.addEventListener('change', filterInventory);

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in (in a real app, check localStorage/session)
    // For now, we'll simulate this for demonstration purposes
    // simulateLoggedInUser();
});

// Set API credentials - these should come from your secure configuration
function setCredentials(apiKey, client, redirect) {
    bungieApiKey = apiKey;
    clientId = client;
    redirectUrl = redirect;
}

// Handle login button click - redirect to Bungie OAuth
function handleLogin() {
    console.log('Login button clicked');
    console.log('Client ID:', clientId);
    console.log('Redirect URL:', redirectUrl);
    
    // Check if we have credentials configured
    if (!clientId || !redirectUrl) {
        alert('Please configure your Bungie API credentials in config.js');
        console.error('Missing credentials for login');
        return;
    }
    
    // Redirect to Bungie's OAuth endpoint with your credentials
    const authUrl = `https://www.bungie.net/en/OAuth/Authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=ReadUserData`;
    
    console.log('Redirecting to:', authUrl);
    window.location.href = authUrl;
}

// Handle logout button click
function handleLogout() {
    currentUser = null;
    showLoginSection();
    // Clear any stored tokens or session data
    localStorage.removeItem('bungie_token');
}

// Show inventory section and hide login section
function showInventorySection() {
    loginSection.style.display = 'none';
    inventorySection.style.display = 'block';
    loadingSection.style.display = 'none';
    
    usernameSpan.textContent = currentUser.name;
    userInfo.style.display = 'block';
}

// Show login section and hide inventory section
function showLoginSection() {
    loginSection.style.display = 'block';
    inventorySection.style.display = 'none';
    loadingSection.style.display = 'none';
    userInfo.style.display = 'none';
}

// Show loading section
function showLoadingSection() {
    loginSection.style.display = 'none';
    inventorySection.style.display = 'none';
    loadingSection.style.display = 'block';
}

// Load inventory data from Bungie API (real implementation)
function loadInventoryData() {
    // In a real app, this would make an API call to Bungie's API
    // This is where you'd use your actual API key and token
    
    showLoadingSection();
    
    // Simulate API delay
    setTimeout(() => {
        inventoryData = [
            {
                id: '1',
                name: 'Voidwalker Armor',
                type: 'armor',
                tier: 'legendary',
                icon: 'armor-icon.png',
                stats: [
                    { name: 'Mobility', value: 30 },
                    { name: 'Resilience', value: 45 },
                    { name: 'Recovery', value: 25 }
                ]
            },
            {
                id: '2',
                name: 'Arc Storm Rifle',
                type: 'weapons',
                tier: 'epic',
                icon: 'weapon-icon.png',
                stats: [
                    { name: 'Damage', value: 85 },
                    { name: 'Range', value: 60 },
                    { name: 'Rate of Fire', value: 70 }
                ]
            },
            {
                id: '3',
                name: 'Solar Shield',
                type: 'armor',
                tier: 'rare',
                icon: 'armor-icon.png',
                stats: [
                    { name: 'Mobility', value: 25 },
                    { name: 'Resilience', value: 50 },
                    { name: 'Recovery', value: 30 }
                ]
            },
            {
                id: '4',
                name: 'Kinetic Blaster',
                type: 'weapons',
                tier: 'uncommon',
                icon: 'weapon-icon.png',
                stats: [
                    { name: 'Damage', value: 70 },
                    { name: 'Range', value: 75 },
                    { name: 'Rate of Fire', value: 65 }
                ]
            },
            {
                id: '5',
                name: 'Void Helmet',
                type: 'armor',
                tier: 'epic',
                icon: 'armor-icon.png',
                stats: [
                    { name: 'Mobility', value: 35 },
                    { name: 'Resilience', value: 40 },
                    { name: 'Recovery', value: 20 }
                ]
            },
            {
                id: '6',
                name: 'Arc Rifle',
                type: 'weapons',
                tier: 'legendary',
                icon: 'weapon-icon.png',
                stats: [
                    { name: 'Damage', value: 95 },
                    { name: 'Range', value: 50 },
                    { name: 'Rate of Fire', value: 80 }
                ]
            }
        ];
        
        displayInventory();
    }, 1000);
}

// Process the OAuth callback and get user data
function processOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        // Exchange authorization code for access token
        // In a real app, you'd make an API call to Bungie's token endpoint
        // This would involve your client_id and client_secret
        
        showLoadingSection();
        
        // Simulate getting the token
        setTimeout(() => {
            // Mock user data (in a real app, this would come from Bungie API)
            currentUser = {
                name: 'DestinyPlayer',
                membershipId: '123456789',
                platform: 'Xbox'
            };
            
            localStorage.setItem('bungie_token', 'mock_token_12345');
            showInventorySection();
            loadInventoryData();
        }, 1000);
    }
}

// Check if we're on the callback page
if (window.location.search.includes('code=')) {
    processOAuthCallback();
}

// Display inventory items
function displayInventory() {
    inventoryItems.innerHTML = '';
    
    if (inventoryData.length === 0) {
        inventoryItems.innerHTML = '<p>No items found in your inventory.</p>';
        return;
    }
    
    inventoryData.forEach(item => {
        const itemCard = createItemCard(item);
        inventoryItems.appendChild(itemCard);
    });
}

// Create item card element
function createItemCard(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    // Get tier class for styling
    const tierClass = `tier-${item.tier}`;
    
    // Build stats HTML
    let statsHtml = '';
    if (item.stats && item.stats.length > 0) {
        statsHtml = '<div class="item-stats">';
        item.stats.forEach(stat => {
            statsHtml += `
                <div class="stat">
                    <span>${stat.name}</span>
                    <span class="stat-value">${stat.value}</span>
                </div>
            `;
        });
        statsHtml += '</div>';
    }
    
    card.innerHTML = `
        <h3 class="item-name">${item.name}</h3>
        <span class="item-type">${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</span>
        <span class="item-tier ${tierClass}">${item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}</span>
        ${statsHtml}
    `;
    
    return card;
}

// Filter inventory based on selections
function filterInventory() {
    const itemType = itemTypeFilter.value;
    const itemTier = itemTierFilter.value;
    
    // In a real app, this would filter the actual data
    // For now, we'll just reload with mock data
    displayInventory();
}

// Mock Bungie API functions (these would be replaced with real API calls)
const BungieAPI = {
    // This would normally handle authentication and API calls to Bungie's servers
    getMembershipData: function() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    membershipId: '123456789',
                    platform: 'Xbox',
                    displayName: 'DestinyPlayer'
                });
            }, 500);
        });
    },
    
    getInventory: function(membershipId, platform) {
        return new Promise((resolve) => {
            setTimeout(() => {
                // Return mock inventory data
                resolve(inventoryData);
            }, 1000);
        });
    }
};

// In a real implementation, you would set up the actual Bungie API integration like this:
/*
function authenticateWithBungie() {
    // Redirect to Bungie's OAuth endpoint
    window.location.href = 'https://www.bungie.net/en/OAuth/Authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=YOUR_REDIRECT_URI';
}

// After successful authentication, get user data and inventory
async function fetchUserData() {
    try {
        const userData = await BungieAPI.getMembershipData();
        currentUser = userData;
        
        // Load inventory data
        const inventory = await BungieAPI.getInventory(userData.membershipId, userData.platform);
        inventoryData = inventory;
        
        displayInventory();
        showInventorySection();
    } catch (error) {
        console.error('Error fetching user data:', error);
        alert('Failed to fetch user data. Please try again.');
    }
}
*/