// Onboarding page: guided creation of the first shortcut
const addForm = document.getElementById('addForm');
const shortcutHostInput = document.getElementById('shortcutHost');
const destinationUrlInput = document.getElementById('destinationUrl');
const messageDiv = document.getElementById('message');
const hostHint = document.getElementById('hostHint');
const stepCreate = document.getElementById('stepCreate');
const stepTry = document.getElementById('stepTry');
const demoSlash = document.getElementById('demoSlash');
const demoOmnibox = document.getElementById('demoOmnibox');
const doneBtn = document.getElementById('doneBtn');

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    setTimeout(() => { messageDiv.className = 'message'; }, 3000);
}

addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const host = shortcutHostInput.value.trim();
    const url = destinationUrlInput.value.trim();
    if (!host || !url) {
        showMessage('Please fill in both fields', 'error');
        return;
    }
    const validation = validateShortcutHost(host);
    if (!validation.valid) {
        showMessage(validation.error, 'error');
        return;
    }
    const normalizedHost = validation.normalized;
    const normalizedUrl = normalizeDestinationUrl(url);
    try {
        const mappings = await loadMappings();
        const updated = { ...mappings, [normalizedHost]: normalizedUrl };
        await saveMappings(updated);
        showTryStep(normalizedHost);
    } catch (error) {
        showMessage('Error saving shortcut: ' + error.message, 'error');
    }
});

function showTryStep(host) {
    demoSlash.textContent = `${host}/`;
    demoOmnibox.textContent = host;
    stepCreate.hidden = true;
    stepTry.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

doneBtn.addEventListener('click', () => {
    window.close();
});
