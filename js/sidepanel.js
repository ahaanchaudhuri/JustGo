// Sidepanel functionality
console.log('sidepanel.js loaded');
let mappings = {};

const addForm = document.getElementById('addForm');
const shortcutHostInput = document.getElementById('shortcutHost');
const destinationUrlInput = document.getElementById('destinationUrl');
const shortcutsList = document.getElementById('shortcutsList');
const emptyState = document.getElementById('emptyState');
const messageDiv = document.getElementById('message');
const hostHint = document.getElementById('hostHint');
const addBtn = document.getElementById('addBtn');

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => { messageDiv.className = 'message'; }, 3000);
}

function updateHostHint(host) {
    if (!host) {
        hostHint.textContent = '';
        hostHint.className = 'form-hint';
        return;
    }
    const normalized = normalizeShortcutHost(host);
    if (normalized.endsWith('.dev')) {
        hostHint.textContent = '⚠️ .dev domains use HSTS - ensure your destination supports HTTPS';
        hostHint.className = 'form-hint warning';
    } else if (normalized.endsWith('.test') || normalized.endsWith('.local')) {
        hostHint.textContent = 'ℹ️ .test/.local domains work well for local development';
        hostHint.className = 'form-hint info';
    } else {
        hostHint.textContent = '';
        hostHint.className = 'form-hint';
    }
}

async function loadMappingsData() {
    try {
        mappings = await loadMappings();
        renderMappings();
        await rebuildDNRRules(mappings);
        await prefillCurrentUrl();
    } catch (error) {
        console.error('Error loading mappings:', error);
        mappings = {};
        renderMappings();
        await prefillCurrentUrl();
    }
}

function renderMappings() {
    const hosts = Object.keys(mappings);
    if (hosts.length === 0) {
        shortcutsList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    shortcutsList.style.display = 'flex';
    emptyState.style.display = 'none';
    shortcutsList.innerHTML = '';
    hosts.forEach(host => {
        const url = mappings[host];
        const displayHost = host.includes('.') ? host : host + '/';
        
        const card = document.createElement('div');
        card.className = 'shortcut-card';
        
        const content = document.createElement('div');
        content.className = 'shortcut-card-content';
        
        const icon = document.createElement('div');
        icon.className = 'shortcut-icon';
        icon.textContent = '🔗';
        icon.setAttribute('aria-hidden', 'true');
        
        const info = document.createElement('div');
        info.className = 'shortcut-info';
        
        const name = document.createElement('div');
        name.className = 'shortcut-name';
        name.textContent = escapeHtml(displayHost);
        
        const urlContainer = document.createElement('div');
        urlContainer.className = 'shortcut-url';
        
        const urlLink = document.createElement('a');
        urlLink.href = escapeHtml(url);
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlLink.className = 'shortcut-url-link';
        urlLink.textContent = escapeHtml(url);
        urlLink.title = escapeHtml(url);
        
        urlContainer.appendChild(urlLink);
        info.appendChild(name);
        info.appendChild(urlContainer);
        content.appendChild(icon);
        content.appendChild(info);
        
        const actions = document.createElement('div');
        actions.className = 'shortcut-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.setAttribute('data-host', escapeHtml(host));
        deleteBtn.setAttribute('aria-label', `Delete shortcut ${escapeHtml(displayHost)}`);
        deleteBtn.setAttribute('title', 'Delete shortcut');
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', () => {
            deleteMapping(host);
        });
        
        actions.appendChild(deleteBtn);
        card.appendChild(content);
        card.appendChild(actions);
        shortcutsList.appendChild(card);
    });
}

async function deleteMapping(host) {
    const displayHost = host.includes('.') ? host : host + '/';
    if (confirm(`Are you sure you want to delete the shortcut "${displayHost}"?`)) {
        delete mappings[host];
        try {
            await saveMappings(mappings);
            await rebuildDNRRules(mappings);
            renderMappings();
            showMessage('Shortcut deleted successfully!', 'success');
        } catch (error) {
            showMessage('Error deleting shortcut: ' + error.message, 'error');
        }
    }
}

async function addMapping(host, url) {
    const validation = validateShortcutHost(host);
    if (!validation.valid) {
        showMessage(validation.error, 'error');
        return false;
    }
    const normalizedHost = validation.normalized;
    const normalizedUrl = normalizeDestinationUrl(url);
    if (mappings[normalizedHost]) {
        const displayHost = normalizedHost.includes('.') ? normalizedHost : normalizedHost + '/';
        showMessage(`Shortcut "${displayHost}" already exists!`, 'error');
        return false;
    }
    mappings[normalizedHost] = normalizedUrl;
    try {
        await saveMappings(mappings);
        await rebuildDNRRules(mappings);
        renderMappings();
        showMessage('Shortcut added successfully!', 'success');
        shortcutHostInput.value = '';
        destinationUrlInput.value = '';
        hostHint.textContent = '';
        hostHint.className = 'form-hint';
        shortcutHostInput.focus();
        chrome.storage.local.remove('pendingDestinationUrl');
        return true;
    } catch (error) {
        showMessage('Error saving shortcut: ' + error.message, 'error');
        delete mappings[normalizedHost];
        return false;
    }
}

function checkPendingUrl() {
    console.log('Checking for pending URL');
    chrome.storage.local.get(['pendingDestinationUrl'], (result) => {
        console.log('Pending URL result:', result);
        if (result.pendingDestinationUrl) {
            destinationUrlInput.value = result.pendingDestinationUrl;
            console.log('Pending URL set:', result.pendingDestinationUrl);
            chrome.storage.local.remove('pendingDestinationUrl');
        } else {
            console.log('No pending URL found');
        }
    });
}

async function getCurrentTabUrl() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                const url = tabs[0].url;
                // Only return URLs for regular web pages
                if (url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
                    resolve(url);
                } else {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });
    });
}

async function prefillCurrentUrl() {
    const url = await getCurrentTabUrl();
    if (url && destinationUrlInput) {
        destinationUrlInput.value = url;
        if (shortcutHostInput) {
            shortcutHostInput.focus();
        }
    }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.pendingDestinationUrl) {
        destinationUrlInput.value = changes.pendingDestinationUrl.newValue || '';
        chrome.storage.local.remove('pendingDestinationUrl');
    }
});

function updateAddButtonState() {
    const host = shortcutHostInput.value.trim();
    const url = destinationUrlInput.value.trim();
    addBtn.disabled = !host || !url;
}

addForm.addEventListener('submit', async (e) => {
    console.log('Form submitted');
    e.preventDefault();
    const host = shortcutHostInput.value.trim();
    const url = destinationUrlInput.value.trim();
    if (!host || !url) {
        showMessage('Please fill in both fields', 'error');
        return;
    }
    
    // Validate URL format
    let finalUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        finalUrl = 'https://' + url;
    }
    
    await addMapping(host, finalUrl);
});

shortcutHostInput.addEventListener('input', (e) => {
    console.log('Updating host hint');
    updateHostHint(e.target.value);
    updateAddButtonState();
});

destinationUrlInput.addEventListener('input', () => {
    updateAddButtonState();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadMappingsData();
        checkPendingUrl();
        updateAddButtonState();
    });
} else {
    loadMappingsData();
    checkPendingUrl();
    updateAddButtonState();
}