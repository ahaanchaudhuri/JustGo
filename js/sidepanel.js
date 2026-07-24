// Side panel: shared manager UI plus current-tab prefill and
// context-menu capture handling.

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
    if (url) {
        ShortcutUI.prefillDestination(url);
    }
}

function checkPendingUrl() {
    chrome.storage.local.get(['pendingDestinationUrl'], (result) => {
        if (result.pendingDestinationUrl) {
            ShortcutUI.prefillDestination(result.pendingDestinationUrl);
            chrome.storage.local.remove('pendingDestinationUrl');
        }
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.pendingDestinationUrl) {
        const url = changes.pendingDestinationUrl.newValue;
        // Ignore the removal event fired by our own cleanup below
        if (url) {
            ShortcutUI.prefillDestination(url);
            chrome.storage.local.remove('pendingDestinationUrl');
        }
    }
});

async function startSidepanel() {
    await ShortcutUI.init();
    await prefillCurrentUrl();
    checkPendingUrl();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startSidepanel);
} else {
    startSidepanel();
}
