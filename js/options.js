// Options page: shared manager UI plus JSON import/export.

const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const fileInput = document.getElementById('fileInput');

function exportMappings() {
    const dataStr = JSON.stringify(ShortcutUI.getMappings(), null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'justgo-shortcuts-' + new Date().toISOString().split('T')[0] + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ShortcutUI.showMessage('Mappings exported successfully!', 'success');
}

async function importMappings(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
                    throw new Error('Invalid JSON format. Expected an object.');
                }
                const merged = { ...ShortcutUI.getMappings(), ...imported };
                const normalizedMappings = {};
                for (const [host, url] of Object.entries(merged)) {
                    const validation = validateShortcutHost(host);
                    if (validation.valid && typeof url === 'string') {
                        normalizedMappings[validation.normalized] = normalizeDestinationUrl(url);
                    }
                }
                await ShortcutUI.replaceMappings(normalizedMappings);
                ShortcutUI.showMessage('Mappings imported successfully!', 'success');
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsText(file);
    });
}

exportBtn.addEventListener('click', exportMappings);
importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        try {
            await importMappings(file);
        } catch (error) {
            ShortcutUI.showMessage('Error importing file: ' + error.message, 'error');
        }
        fileInput.value = '';
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ShortcutUI.init());
} else {
    ShortcutUI.init();
}
