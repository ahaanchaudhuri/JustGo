// Sidepanel functionality
console.log('sidepanel.js loaded');
let mappings = {};

const addForm = document.getElementById('addForm');
const shortcutHostInput = document.getElementById('shortcutHost');
const destinationUrlInput = document.getElementById('destinationUrl');
const mappingsTable = document.getElementById('mappingsTable');
const mappingsTableBody = document.getElementById('mappingsTableBody');
const emptyState = document.getElementById('emptyState');
const messageDiv = document.getElementById('message');
const hostHint = document.getElementById('hostHint');

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
        mappingsTable.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    mappingsTable.style.display = 'table';
    emptyState.style.display = 'none';
    mappingsTableBody.innerHTML = '';
    hosts.forEach(host => {
        const row = document.createElement('tr');
        const url = mappings[host];
        const displayHost = host.includes('.') ? host : host + '/';
        row.innerHTML = `
            <td class="shortcut-cell">${escapeHtml(displayHost)}</td>
            <td class="url-cell">
                <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="url-link">${escapeHtml(url)}</a>
            </td>
            <td>
                <button class="btn btn-delete" data-host="${escapeHtml(host)}">Delete</button>
            </td>
        `;
        mappingsTableBody.appendChild(row);
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteMapping(e.target.getAttribute('data-host'));
        });
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

addForm.addEventListener('submit', async (e) => {
    console.log('Form submitted');
    e.preventDefault();
    const host = shortcutHostInput.value.trim();
    const url = destinationUrlInput.value.trim();
    if (!host || !url) {
        showMessage('Please fill in both fields', 'error');
        return;
    }
    await addMapping(host, url);
});

shortcutHostInput.addEventListener('input', (e) => {
    console.log('Updating host hint');
    updateHostHint(e.target.value);
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadMappingsData();
        checkPendingUrl();
    });
} else {
    loadMappingsData();
    checkPendingUrl();
}