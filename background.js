let sidePanelOpened = false;

// Handle keyboard shortcut to open side panel
chrome.commands.onCommand.addListener((command) => {
    if (command === 'open-sidepanel') {
        // Use callback to get tab ID immediately within user gesture context
        chrome.tabs.query({ active: true, currentWindow: true}, (tabs) => {
            if (tabs && tabs.length > 0) {
                const tabId = tabs[0].id;
                const tabUrl = tabs[0].url;
                console.log('Tab ID:', tabId);
                console.log('Tab URL:', tabUrl);
                
                if (!sidePanelOpened) {
                    chrome.sidePanel.open({ tabId: tabId });
                    sidePanelOpened = true;
                } else {
                    chrome.sidePanel.close({ tabId: tabId });
                    sidePanelOpened = false;
                }
            }
        });
    }
});

