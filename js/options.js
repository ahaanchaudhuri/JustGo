// Options page functionality
let mappings = {};

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
    } catch (error) {
        console.error('Error loading mappings:', error);
        mappings = {};
        renderMappings();
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
        return true;
    } catch (error) {
        showMessage('Error saving shortcut: ' + error.message, 'error');
        delete mappings[normalizedHost];
        return false;
    }
}

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

async function importMappings(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (typeof imported !== 'object' || Array.isArray(imported)) {
                    throw new Error('Invalid JSON format. Expected an object.');
                }
                const normalizedMappings = {};
                for (const [host, url] of Object.entries({ ...mappings, ...imported })) {
                    const validation = validateShortcutHost(host);
                    if (validation.valid) {
                        normalizedMappings[validation.normalized] = normalizeDestinationUrl(url);
                    }
                }
                mappings = normalizedMappings;
                await saveMappings(mappings);
                await rebuildDNRRules(mappings);
                renderMappings();
                showMessage('Mappings imported successfully!', 'success');
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file);
    });
}

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

shortcutHostInput.addEventListener('input', (e) => {
    updateHostHint(e.target.value);
});

exportBtn.addEventListener('click', exportMappings);
importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            await importMappings(file);
        } catch (error) {
            showMessage('Error importing file: ' + error.message, 'error');
        }
        fileInput.value = '';
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadMappingsData);
} else {
    loadMappingsData();
}
