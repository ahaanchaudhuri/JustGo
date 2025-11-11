// Mappings object to store shortcut hosts and their destination URLs
// Format: { "frontend.dev": "http://localhost:5173", "docs": "https://docs.google.com" }
let mappings = {};

// DOM elements
const addForm = document.getElementById('addForm');
const shortcutHostInput = document.getElementById('shortcutHost');
const destinationUrlInput = document.getElementById('destinationUrl');
const mappingsTable = document.getElementById('mappingsTable');
const mappingsTableBody = document.getElementById('mappingsTableBody');
const emptyState = document.getElementById('emptyState');
const messageDiv = document.getElementById('message');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const fileInput = document.getElementById('fileInput');
const hostHint = document.getElementById('hostHint');

// Load mappings from chrome.storage
function loadMappings() {
    chrome.storage.sync.get(['mappings'], (result) => {
        if (result.mappings) {
            mappings = result.mappings;
        } else {
            mappings = {};
        }
        renderMappings();
        rebuildDNRRules();
    });
}

// Save mappings to chrome.storage
function saveMappings() {
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

// Normalize shortcut host: trim, lowercase, strip protocol/slashes
function normalizeShortcutHost(host) {
    return host
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')  // Remove http:// or https://
        .replace(/^\/+/, '')          // Remove leading slashes
        .replace(/\/+$/, '')          // Remove trailing slashes
        .split('/')[0];               // Take only the host part
}

// Validate and normalize destination URL
function normalizeDestinationUrl(url) {
    url = url.trim();
    
    // If no protocol, default to https://
    if (!url.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:/)) {
        url = 'https://' + url;
    }
    
    // Ensure it ends with / for proper redirect
    if (!url.endsWith('/')) {
        url += '/';
    }
    
    return url;
}

// Validate shortcut host format
function validateShortcutHost(host) {
    const normalized = normalizeShortcutHost(host);
    
    // Basic validation: should be a valid hostname
    if (!normalized || normalized.length === 0) {
        return { valid: false, error: 'Host cannot be empty' };
    }
    
    // Check for valid hostname characters
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$/.test(normalized)) {
        return { valid: false, error: 'Invalid hostname format' };
    }
    
    return { valid: true, normalized };
}

// Update host hint based on input
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

// Convert mappings to DeclarativeNetRequest rules
function buildDNRRules() {
    const rules = [];
    let ruleId = 1;
    
    Object.entries(mappings).forEach(([shortcutHost, destinationUrl]) => {
        // Rule for the main host (e.g., frontend.dev)
        rules.push({
            id: ruleId++,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    url: destinationUrl
                }
            },
            condition: {
                urlFilter: `*://${shortcutHost}/*`,
                resourceTypes: ['main_frame']
            }
        });
        
        // Rule for www.<host> (e.g., www.frontend.dev)
        rules.push({
            id: ruleId++,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    url: destinationUrl
                }
            },
            condition: {
                urlFilter: `*://www.${shortcutHost}/*`,
                resourceTypes: ['main_frame']
            }
        });
    });
    
    return rules;
}

// Rebuild DNR rules by removing old ones and adding new ones
async function rebuildDNRRules() {
    try {
        // Get existing dynamic rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const existingRuleIds = existingRules.map(rule => rule.id);
        
        // Remove all existing dynamic rules
        if (existingRuleIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: existingRuleIds
            });
        }
        
        // Build and add new rules from current mappings
        const newRules = buildDNRRules();
        if (newRules.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: newRules
            });
        }
        
        console.log(`Rebuilt ${newRules.length} DNR rules from ${Object.keys(mappings).length} mappings`);
    } catch (error) {
        console.error('Error rebuilding DNR rules:', error);
        showMessage('Error updating redirect rules: ' + error.message, 'error');
    }
}

// Render mappings table
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
        
        // Display host with "/" if it doesn't have a TLD (no dot)
        const displayHost = host.includes('.') ? host : host + '/';
        
        row.innerHTML = `
            <td class="shortcut-cell">${escapeHtml(displayHost)}</td>
            <td class="url-cell">${escapeHtml(url)}</td>
            <td>
                <button class="btn btn-delete" data-host="${escapeHtml(host)}">Delete</button>
            </td>
        `;
        
        mappingsTableBody.appendChild(row);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const host = e.target.getAttribute('data-host');
            deleteMapping(host);
        });
    });
}

// Delete a mapping
async function deleteMapping(host) {
    if (confirm(`Are you sure you want to delete the shortcut "${host}"?`)) {
        delete mappings[host];
        try {
            await saveMappings();
            await rebuildDNRRules();
            renderMappings();
            showMessage('Shortcut deleted successfully!', 'success');
        } catch (error) {
            showMessage('Error deleting shortcut: ' + error.message, 'error');
        }
    }
}

// Add a new mapping
async function addMapping(host, url) {
    // Validate and normalize
    const validation = validateShortcutHost(host);
    if (!validation.valid) {
        showMessage(validation.error, 'error');
        return false;
    }
    
    const normalizedHost = validation.normalized;
    const normalizedUrl = normalizeDestinationUrl(url);
    
    if (mappings[normalizedHost]) {
        showMessage(`Shortcut "${normalizedHost}" already exists!`, 'error');
        return false;
    }
    
    mappings[normalizedHost] = normalizedUrl;
    
    try {
        await saveMappings();
        await rebuildDNRRules();
        renderMappings();
        showMessage('Shortcut added successfully!', 'success');
        
        // Clear form
        shortcutHostInput.value = '';
        destinationUrlInput.value = '';
        hostHint.textContent = '';
        hostHint.className = 'form-hint';
        shortcutHostInput.focus();
        
        return true;
    } catch (error) {
        showMessage('Error saving shortcut: ' + error.message, 'error');
        delete mappings[normalizedHost]; // Rollback
        return false;
    }
}

// Export mappings to JSON file
function exportMappings() {
    const dataStr = JSON.stringify(mappings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'justgo-shortcuts-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('Mappings exported successfully!', 'success');
}

// Import mappings from JSON file
async function importMappings(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                // Validate imported data
                if (typeof imported !== 'object' || Array.isArray(imported)) {
                    throw new Error('Invalid JSON format. Expected an object.');
                }
                
                // Merge with existing mappings (imported takes precedence)
                const beforeCount = Object.keys(mappings).length;
                mappings = { ...mappings, ...imported };
                const afterCount = Object.keys(mappings).length;
                const added = afterCount - beforeCount;
                
                // Normalize all imported mappings
                const normalizedMappings = {};
                for (const [host, url] of Object.entries(mappings)) {
                    const validation = validateShortcutHost(host);
                    if (validation.valid) {
                        normalizedMappings[validation.normalized] = normalizeDestinationUrl(url);
                    }
                }
                mappings = normalizedMappings;
                
                await saveMappings();
                await rebuildDNRRules();
                renderMappings();
                
                showMessage(`Imported ${added} new shortcut(s)!`, 'success');
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file);
    });
}

// Show message to user
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const host = shortcutHostInput.value.trim();
    const url = destinationUrlInput.value.trim();
    
    if (!host || !url) {
        showMessage('Please fill in both fields', 'error');
        return;
    }
    
    await addMapping(host, url);
});

// Update hint as user types
shortcutHostInput.addEventListener('input', (e) => {
    updateHostHint(e.target.value);
});

// Export button
exportBtn.addEventListener('click', exportMappings);

// Import button
importBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            await importMappings(file);
        } catch (error) {
            showMessage('Error importing file: ' + error.message, 'error');
        }
        // Reset file input
        fileInput.value = '';
    }
});

// Load mappings when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadMappings();
});
