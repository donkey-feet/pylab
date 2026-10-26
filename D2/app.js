/* Destiny 2 Gear Manager - App Logic */

const CLIENT_ID = '42903';
const API_KEY = 'a9f4c23a44744d78ac61aa7e0afcd815';
let itemManifest = {};
let currentFilter = 'all';
let cachedData = null;

// 1. Check if Bungie redirected back with an auth code
const urlParams = new URLSearchParams(window.location.search);
const authCode = urlParams.get('code');

if (authCode) {
  fetchToken(authCode);
} else if (localStorage.getItem('bungie_access_token')) {
  // Already authenticated
}

// 2. Update DOM targets for weapons/armor rendering
function renderWeapons(items) {
  const container = document.getElementById('weapons-container');
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<div class="empty">No weapons found</div>';
    return;
  }
  items.forEach(item => {
    const itemElement = createItemElement(item);
    container.appendChild(itemElement);
  });
}

function renderArmor(items) {
  const container = document.getElementById('armor-container');
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<div class="empty">No armor found</div>';
    return;
  }
  items.forEach(item => {
    const itemElement = createItemElement(item);
    container.appendChild(itemElement);
  });
}

function createItemElement(item) {
  // Reuse existing item rendering logic
  const itemElement = document.createElement('div');
  itemElement.className = 'item-row';
  itemElement.innerHTML = `
    <div class="item-info">
      <img class="item-icon" src="${item.icon}" alt="${item.name}">
      <div>
        <div class="item-name">${item.name}</div>
        <div class="item-type">${item.type}</div>
      </div>
    </div>
  `;
  return itemElement;
}

// 3. Fetch and process profile data
async function fetchProfileAndGear() {
  // ... (existing implementation would process weapons/armor)
  const weapons = [];
  const armor = [];
  
  // Split items into weapons/armor categories
  for (const item of cachedData) {
    if (item.category === 'Weapons') weapons.push(item);
    else if (item.category === 'Armor') armor.push(item);
  }
  
  renderWeapons(weapons);
  renderArmor(armor);
}

// 4. Authentication flow
function fetchToken(code) {
  // ... (existing implementation)
}

// 5. Initialize UI
function init() {
  document.getElementById('login-btn').addEventListener('click', () => {
    const redirectUri = encodeURIComponent('http://localhost:8080');
    const authUrl = `https://www.bungie.net/en/OAuth/Authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}`;
    window.location.href = authUrl;
  });
  
  document.getElementById('profile-btn').addEventListener('click', () => {
    fetchProfileAndGear();
  });
}

// Initialize on page load
init();