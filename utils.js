// Shared utility functions

// Normalize shortcut host: trim, lowercase, strip protocol/slashes
function normalizeShortcutHost(host) {
    return host
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .split('/')[0];
}

// Validate and normalize destination URL
function normalizeDestinationUrl(url) {
    url = url.trim();
    if (!url.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
        url = 'https://' + url;
    }
    if (!url.endsWith('/')) {
        url += '/';
    }
    return url;
}

// Validate shortcut host format
function validateShortcutHost(host) {
    const normalized = normalizeShortcutHost(host);
    if (!normalized || normalized.length === 0) {
        return { valid: false, error: 'Host cannot be empty' };
    }
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$/.test(normalized)) {
        return { valid: false, error: 'Invalid hostname format' };
    }
    return { valid: true, normalized };
}

// Convert mappings to DeclarativeNetRequest rules
function buildDNRRules(mappings) {
    const rules = [];
    let ruleId = 1;
    Object.entries(mappings).forEach(([shortcutHost, destinationUrl]) => {
        rules.push({
            id: ruleId++,
            priority: 1,
            action: { type: 'redirect', redirect: { url: destinationUrl } },
            condition: { urlFilter: `*://${shortcutHost}/*`, resourceTypes: ['main_frame'] }
        });
        rules.push({
            id: ruleId++,
            priority: 1,
            action: { type: 'redirect', redirect: { url: destinationUrl } },
            condition: { urlFilter: `*://www.${shortcutHost}/*`, resourceTypes: ['main_frame'] }
        });
    });
    return rules;
}

// Rebuild DNR rules
async function rebuildDNRRules(mappings) {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);
    if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRuleIds });
    }
    const newRules = buildDNRRules(mappings);
    if (newRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ addRules: newRules });
    }
}

// Load mappings from chrome.storage
function loadMappings() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['mappings'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.mappings || {});
            }
        });
    });
}

// Save mappings to chrome.storage
function saveMappings(mappings) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ mappings: mappings }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

