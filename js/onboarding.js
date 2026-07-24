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
const starterChips = document.getElementById('starterChips');

// Curated starter shortcuts offered after the first save
const STARTER_SHORTCUTS = [
    { host: 'mail', url: 'https://mail.google.com/' },
    { host: 'cal', url: 'https://calendar.google.com/' },
    { host: 'docs', url: 'https://docs.google.com/' },
    { host: 'drive', url: 'https://drive.google.com/' },
    { host: 'maps', url: 'https://maps.google.com/' },
    { host: 'gh', url: 'https://github.com/' },
    { host: 'news', url: 'https://news.ycombinator.com/' },
    { host: 'x', url: 'https://x.com/' }
];

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
    renderStarterChips();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function renderStarterChips() {
    let existing = {};
    try {
        existing = await loadMappings();
    } catch (error) {
        console.error('Error loading mappings for starter pack:', error);
    }
    starterChips.innerHTML = '';
    STARTER_SHORTCUTS.forEach(({ host, url }) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'starter-chip';
        chip.textContent = `${host} → ${url.replace(/^https:\/\//, '').replace(/\/$/, '')}`;
        if (existing[host]) {
            chip.classList.add('added');
            chip.disabled = true;
            chip.textContent = `✓ ${host}`;
        }
        chip.addEventListener('click', async () => {
            try {
                const mappings = await loadMappings();
                if (!mappings[host]) {
                    await saveMappings({ ...mappings, [host]: url });
                }
                chip.classList.add('added');
                chip.disabled = true;
                chip.textContent = `✓ ${host}`;
            } catch (error) {
                showMessage('Error adding shortcut: ' + error.message, 'error');
            }
        });
        starterChips.appendChild(chip);
    });
}

doneBtn.addEventListener('click', () => {
    window.close();
});
