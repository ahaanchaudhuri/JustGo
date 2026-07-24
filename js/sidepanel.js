// Sidepanel functionality
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

// After a save, teach the user exactly how to invoke the shortcut
function showUsageHint(host) {
    messageDiv.textContent = '';
    const intro = document.createTextNode('Saved! Type ');
    const kbd1 = document.createElement('kbd');
    kbd1.textContent = `${host}/`;
    const middle = document.createTextNode(' or ');
    const kbd2 = document.createElement('kbd');
    kbd2.textContent = `go ${host}`;
    const outro = document.createTextNode(' in the address bar.');
    messageDiv.append(intro, kbd1, middle, kbd2, outro);
    messageDiv.className = 'message success';
    setTimeout(() => { messageDiv.className = 'message'; }, 6000);
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
    } catch (error) {
        console.error('Error loading mappings:', error);
        mappings = {};
    }
    renderMappings();
    await prefillCurrentUrl();
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
        name.textContent = displayHost;

        const urlContainer = document.createElement('div');
        urlContainer.className = 'shortcut-url';

        const urlLink = document.createElement('a');
        urlLink.href = url;
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlLink.className = 'shortcut-url-link';
        urlLink.textContent = url;
        urlLink.title = url;

        urlContainer.appendChild(urlLink);
        info.appendChild(name);
        info.appendChild(urlContainer);
        content.appendChild(icon);
        content.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'shortcut-actions';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.setAttribute('data-host', host);
        deleteBtn.setAttribute('aria-label', `Delete shortcut ${displayHost}`);
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
        renderMappings();
        showUsageHint(normalizedHost);
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

// Prefill a suggested name for the given URL. Auto-suggestions are kept
// selected so typing replaces them; user-typed text is never overwritten.
let lastSuggestedName = '';
function applySuggestedName(url) {
    const current = shortcutHostInput.value.trim();
    if (current && current !== lastSuggestedName) {
        return;
    }
    const suggestion = suggestShortcutName(url);
    if (!suggestion || mappings[suggestion]) {
        return;
    }
    shortcutHostInput.value = suggestion;
    lastSuggestedName = suggestion;
    updateHostHint(suggestion);
    updateAddButtonState();
    shortcutHostInput.focus();
    shortcutHostInput.select();
}

function checkPendingUrl() {
    chrome.storage.local.get(['pendingDestinationUrl'], (result) => {
        if (result.pendingDestinationUrl) {
            destinationUrlInput.value = result.pendingDestinationUrl;
            applySuggestedName(result.pendingDestinationUrl);
            updateAddButtonState();
            chrome.storage.local.remove('pendingDestinationUrl');
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
        applySuggestedName(url);
        updateAddButtonState();
        if (shortcutHostInput) {
            shortcutHostInput.focus();
        }
    }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.pendingDestinationUrl) {
        const url = changes.pendingDestinationUrl.newValue;
        // Ignore the removal event fired by our own cleanup below
        if (url) {
            destinationUrlInput.value = url;
            applySuggestedName(url);
            updateAddButtonState();
            chrome.storage.local.remove('pendingDestinationUrl');
        }
    }
    // Stay in sync when shortcuts change elsewhere (options page, another machine)
    if (areaName === 'sync' && changes.mappings) {
        mappings = changes.mappings.newValue || {};
        renderMappings();
    }
});

function updateAddButtonState() {
    const host = shortcutHostInput.value.trim();
    const url = destinationUrlInput.value.trim();
    addBtn.disabled = !host || !url;
}

addForm.addEventListener('submit', async (e) => {
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
