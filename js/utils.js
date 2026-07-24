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
    // Only add a trailing slash to bare origins — never to URLs with a
    // path, query, or fragment (it would corrupt them, e.g. "?q=%s/")
    try {
        const parsed = new URL(url);
        if (parsed.pathname === '/' && !parsed.search && !parsed.hash && !url.endsWith('/')) {
            url += '/';
        }
    } catch {
        // Leave unparseable values as-is; DNR simply won't match them
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

// Convert mappings to DeclarativeNetRequest rules.
// Destinations containing %s become regex rules so the address-bar path
// fills the parameter: "gh/claude" -> "github.com/search?q=claude".
function buildDNRRules(mappings) {
    const rules = [];
    let ruleId = 1;
    Object.entries(mappings).forEach(([shortcutHost, destinationUrl]) => {
        if (destinationUrl.includes('%s')) {
            const escapedHost = shortcutHost.replace(/\./g, '\\.');
            rules.push({
                id: ruleId++,
                priority: 1,
                action: {
                    type: 'redirect',
                    redirect: { regexSubstitution: destinationUrl.replace(/%s/g, '\\1') }
                },
                condition: {
                    regexFilter: `^https?://(?:www\\.)?${escapedHost}/(.*)`,
                    resourceTypes: ['main_frame']
                }
            });
            return;
        }
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

// Path segments too generic to make good shortcut names
const GENERIC_SEGMENTS = new Set([
    'index', 'home', 'watch', 'search', 'login', 'signin', 'signup',
    'view', 'page', 'pages', 'post', 'posts', 'article', 'articles',
    'item', 'items', 'detail', 'details', 'status', 'video', 'videos',
    'thread', 'threads', 'comments', 'wiki',
    'en', 'us', 'www', 'app', 'web', 'default'
]);

// Suggest a short, typeable shortcut name for a URL.
// Prefers a meaningful last path segment (e.g. a repo name), falls back
// to the first hostname label. Returns '' if nothing usable.
function suggestShortcutName(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return '';
    }
    const clean = (text) => decodeURIComponent(text)
        .toLowerCase()
        .replace(/\.[a-z0-9]{1,5}$/, '')
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
        const candidate = clean(segments[segments.length - 1]);
        const usable = candidate.length >= 2 && candidate.length <= 24
            && !/^\d+$/.test(candidate)
            && !GENERIC_SEGMENTS.has(candidate)
            && validateShortcutHost(candidate).valid;
        if (usable) {
            return candidate;
        }
    }
    const label = parsed.hostname.replace(/^www\./, '').split('.')[0];
    const fallback = clean(label);
    if (fallback && validateShortcutHost(fallback).valid) {
        return fallback;
    }
    return '';
}

// True if every character of query appears in order within target
function isSubsequence(query, target) {
    let i = 0;
    for (const ch of target) {
        if (ch === query[i]) i++;
        if (i === query.length) return true;
    }
    return query.length === 0;
}

// Rank shortcuts against a query for omnibox suggestions.
// Returns [{ host, url, score }] sorted best-first; empty query returns everything.
function rankShortcuts(query, mappings) {
    const q = (query || '').trim().toLowerCase();
    const entries = Object.entries(mappings).map(([host, url]) => ({ host, url }));
    if (!q) {
        return entries.map(e => ({ ...e, score: 0 }))
            .sort((a, b) => a.host.localeCompare(b.host));
    }
    const scored = [];
    entries.forEach(entry => {
        const host = entry.host.toLowerCase();
        const url = entry.url.toLowerCase();
        let score = -1;
        if (host === q) score = 100;
        else if (host.startsWith(q)) score = 80;
        else if (host.includes(q)) score = 60;
        else if (isSubsequence(q, host)) score = 40;
        else if (url.includes(q)) score = 20;
        if (score >= 0) scored.push({ ...entry, score });
    });
    return scored.sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}

