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
    description: 'JustGo — type a shortcut name to jump to it'
});

chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    try {
        const mappings = await loadMappings();
        const ranked = rankShortcuts(text, mappings);
        suggest(ranked.slice(0, 8).map(({ host, url }) => ({
            content: host,
            description: `${escapeXml(host)} <dim>—</dim> <url>${escapeXml(url)}</url>`
        })));
    } catch (error) {
        console.error('Error building omnibox suggestions:', error);
    }
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    let destination;
    try {
        const mappings = await loadMappings();
        const query = text.trim().toLowerCase();
        destination = mappings[query];
        if (!destination) {
            const ranked = rankShortcuts(query, mappings);
            if (ranked.length > 0) {
                destination = ranked[0].url;
            }
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
