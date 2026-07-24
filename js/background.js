importScripts('utils.js');

const ONBOARDING_URL = 'html/onboarding.html';

// Clicking the toolbar icon opens/closes the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error('Error setting panel behavior:', error));

// Keep redirect rules in sync with storage, including changes synced
// from other machines while no UI page is open.
chrome.runtime.onInstalled.addListener(async (details) => {
    chrome.contextMenus.create({
        id: 'justgo-save-page',
        title: 'JustGo: create shortcut for this page',
        contexts: ['page']
    });
    chrome.contextMenus.create({
        id: 'justgo-save-link',
        title: 'JustGo: create shortcut for this link',
        contexts: ['link']
    });
    try {
        const mappings = await loadMappings();
        await rebuildDNRRules(mappings);
    } catch (error) {
        console.error('Error rebuilding rules on install:', error);
    }
    if (details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL(ONBOARDING_URL) });
    }
});

// Right-click capture: stash the URL, then open the panel prefilled with it
chrome.contextMenus.onClicked.addListener((info, tab) => {
    let url;
    if (info.menuItemId === 'justgo-save-link') {
        url = info.linkUrl;
    } else if (info.menuItemId === 'justgo-save-page') {
        url = info.pageUrl;
    }
    if (!url || !tab) {
        return;
    }
    // Open first: sidePanel.open must run synchronously in the user gesture
    chrome.sidePanel.open({ tabId: tab.id });
    chrome.storage.local.set({ pendingDestinationUrl: url });
});

chrome.runtime.onStartup.addListener(async () => {
    try {
        const mappings = await loadMappings();
        await rebuildDNRRules(mappings);
    } catch (error) {
        console.error('Error rebuilding rules on startup:', error);
    }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.mappings) {
        rebuildDNRRules(changes.mappings.newValue || {})
            .catch((error) => console.error('Error rebuilding rules on change:', error));
    }
});

// Keyboard shortcut opens the side panel
chrome.commands.onCommand.addListener((command) => {
    if (command === 'open-sidepanel') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
                chrome.sidePanel.open({ tabId: tabs[0].id });
            }
        });
    }
});

// Omnibox: type "go" + Tab, then a shortcut name
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

chrome.omnibox.setDefaultSuggestion({
    description: 'JustGo — type a shortcut name to jump, or "add &lt;name&gt;" to save this page'
});

// Split omnibox input into a shortcut query and optional %s arguments
function parseOmniboxInput(text) {
    const parts = text.trim().split(/\s+/);
    return { query: (parts[0] || '').toLowerCase(), args: parts.slice(1).join(' ') };
}

function fillParams(destination, args) {
    return destination.replace(/%s/g, encodeURIComponent(args));
}

// "add <name>" quick-captures the current tab's URL under that name
const ADD_COMMAND_PATTERN = /^add\s+(\S+)\s*$/i;
function parseAddCommand(text) {
    const match = text.trim().match(ADD_COMMAND_PATTERN);
    return match ? match[1] : null;
}

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const addName = parseAddCommand(text);
    if (addName) {
        try {
            const validation = validateShortcutHost(addName);
            if (!validation.valid) {
                suggest([{ content: text, description: `<match>Can't save</match> — ${escapeXml(validation.error)}` }]);
                return;
            }
            const mappings = await loadMappings();
            const existing = mappings[validation.normalized];
            const description = existing
                ? `<match>Overwrite</match> "${escapeXml(validation.normalized)}" <dim>— currently points to ${escapeXml(existing)}</dim>`
                : `<match>Save this page</match> as "${escapeXml(validation.normalized)}"`;
            suggest([{ content: text, description }]);
        } catch (error) {
            console.error('Error building add-command suggestion:', error);
        }
        return;
    }
    try {
        const mappings = await loadMappings();
        const { query, args } = parseOmniboxInput(text);
        const ranked = rankShortcuts(query, mappings);
        suggest(ranked.slice(0, 8).map(({ host, url }) => {
            const preview = url.includes('%s') && args ? fillParams(url, args) : url;
            return {
                content: args ? `${host} ${args}` : host,
                description: `${escapeXml(host)} <dim>—</dim> <url>${escapeXml(preview)}</url>`
            };
        }));
    } catch (error) {
        console.error('Error building omnibox suggestions:', error);
    }
});

// Brief badge flash on the toolbar icon as feedback for the "add" command,
// since it deliberately doesn't navigate anywhere.
let badgeClearTimer;
function flashBadge(text, color) {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    clearTimeout(badgeClearTimer);
    badgeClearTimer = setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1800);
}

async function handleQuickAdd(nameRaw) {
    const validation = validateShortcutHost(nameRaw);
    if (!validation.valid) {
        flashBadge('!', '#DC2626');
        return;
    }
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            flashBadge('!', '#DC2626');
            return;
        }
        const mappings = await loadMappings();
        const normalizedUrl = normalizeDestinationUrl(tab.url);
        await saveMappings({ ...mappings, [validation.normalized]: normalizedUrl });
        flashBadge('✓', '#059669');
    } catch (error) {
        console.error('Error quick-adding shortcut:', error);
        flashBadge('!', '#DC2626');
    }
}

// Track how often each shortcut is used so the manager can sort by frecency
function recordUsage(host) {
    chrome.storage.local.get(['usage'], (result) => {
        const usage = result.usage || {};
        const entry = usage[host] || { count: 0, last: 0 };
        const updated = {
            ...usage,
            [host]: { count: entry.count + 1, last: Date.now() }
        };
        chrome.storage.local.set({ usage: updated });
    });
}

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    const addName = parseAddCommand(text);
    if (addName) {
        // No navigation on purpose — the whole point is staying on this page
        await handleQuickAdd(addName);
        return;
    }
    let matchedHost;
    let destination;
    try {
        const mappings = await loadMappings();
        const { query, args } = parseOmniboxInput(text);
        if (mappings[query]) {
            matchedHost = query;
        } else {
            const ranked = rankShortcuts(query, mappings);
            if (ranked.length > 0) {
                matchedHost = ranked[0].host;
            }
        }
        if (matchedHost) {
            destination = mappings[matchedHost];
            if (destination.includes('%s')) {
                destination = fillParams(destination, args);
            }
            recordUsage(matchedHost);
        }
    } catch (error) {
        console.error('Error resolving omnibox entry:', error);
    }
    if (!destination) {
        // No match — open the manager so the user can create it
        destination = chrome.runtime.getURL('html/options.html');
    }
    if (disposition === 'currentTab') {
        chrome.tabs.update({ url: destination });
    } else {
        chrome.tabs.create({ url: destination, active: disposition === 'newForegroundTab' });
    }
});
