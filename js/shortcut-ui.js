// Shared UI controller for the shortcut manager pages (side panel + options).
// Requires utils.js loaded first and the standard manager DOM ids present.
const ShortcutUI = (() => {
    let mappings = {};
    let usage = {};
    let searchQuery = '';
    let editingHost = null;
    let lastSuggestedName = '';
    const el = {};

    function cacheElements() {
        el.addForm = document.getElementById('addForm');
        el.shortcutHost = document.getElementById('shortcutHost');
        el.destinationUrl = document.getElementById('destinationUrl');
        el.shortcutsList = document.getElementById('shortcutsList');
        el.emptyState = document.getElementById('emptyState');
        el.message = document.getElementById('message');
        el.hostHint = document.getElementById('hostHint');
        el.addBtn = document.getElementById('addBtn');
        el.searchInput = document.getElementById('searchInput');
    }

    function showMessage(text, type) {
        el.message.textContent = text;
        el.message.className = `message ${type}`;
        setTimeout(() => { el.message.className = 'message'; }, 3000);
    }

    // After a save, teach the user exactly how to invoke the shortcut
    function showUsageHint(host) {
        el.message.textContent = '';
        const intro = document.createTextNode('Saved! Type ');
        const kbd1 = document.createElement('kbd');
        kbd1.textContent = `${host}/`;
        const middle = document.createTextNode(' or ');
        const kbd2 = document.createElement('kbd');
        kbd2.textContent = `go ${host}`;
        const outro = document.createTextNode(' in the address bar.');
        el.message.append(intro, kbd1, middle, kbd2, outro);
        el.message.className = 'message success';
        setTimeout(() => { el.message.className = 'message'; }, 6000);
    }

    function updateHostHint(host) {
        if (!host) {
            el.hostHint.textContent = '';
            el.hostHint.className = 'form-hint';
            return;
        }
        const normalized = normalizeShortcutHost(host);
        if (normalized.endsWith('.dev')) {
            el.hostHint.textContent = '⚠️ .dev domains use HSTS - ensure your destination supports HTTPS';
            el.hostHint.className = 'form-hint warning';
        } else if (normalized.endsWith('.test') || normalized.endsWith('.local')) {
            el.hostHint.textContent = 'ℹ️ .test/.local domains work well for local development';
            el.hostHint.className = 'form-hint info';
        } else {
            el.hostHint.textContent = '';
            el.hostHint.className = 'form-hint';
        }
    }

    function updateAddButtonState() {
        const host = el.shortcutHost.value.trim();
        const url = el.destinationUrl.value.trim();
        el.addBtn.disabled = !host || !url;
    }

    function displayName(host) {
        return host.includes('.') ? host : host + '/';
    }

    // Most-used first, then most recent, then alphabetical.
    // When searching, relevance (rankShortcuts) takes over.
    function orderedHosts() {
        if (searchQuery) {
            return rankShortcuts(searchQuery, mappings).map(entry => entry.host);
        }
        return Object.keys(mappings).sort((a, b) => {
            const ua = usage[a] || { count: 0, last: 0 };
            const ub = usage[b] || { count: 0, last: 0 };
            return ub.count - ua.count || ub.last - ua.last || a.localeCompare(b);
        });
    }

    function renderMappings() {
        if (el.searchInput) {
            el.searchInput.style.display = Object.keys(mappings).length > 0 ? '' : 'none';
        }
        const hosts = orderedHosts();
        if (hosts.length === 0) {
            el.shortcutsList.style.display = 'none';
            el.emptyState.style.display = 'block';
            const emptyText = el.emptyState.querySelector('p');
            if (emptyText) {
                emptyText.textContent = searchQuery
                    ? `No shortcuts match "${searchQuery}"`
                    : 'No shortcuts yet. Add your first shortcut above!';
            }
            return;
        }
        el.shortcutsList.style.display = 'flex';
        el.emptyState.style.display = 'none';
        el.shortcutsList.innerHTML = '';
        hosts.forEach((host, index) => {
            const card = host === editingHost
                ? buildEditCard(host, mappings[host])
                : buildCard(host, mappings[host]);
            // stagger the entrance animation, capped so long lists stay snappy
            card.style.setProperty('--i', Math.min(index, 10));
            el.shortcutsList.appendChild(card);
        });
    }

    function buildCard(host, url) {
        const card = document.createElement('div');
        card.className = 'shortcut-card';
        card.setAttribute('data-host', host);

        const content = document.createElement('div');
        content.className = 'shortcut-card-content';

        const icon = document.createElement('div');
        icon.className = 'shortcut-icon';
        icon.textContent = host.charAt(0).toUpperCase();
        icon.setAttribute('aria-hidden', 'true');

        const info = document.createElement('div');
        info.className = 'shortcut-info';

        const name = document.createElement('div');
        name.className = 'shortcut-name';
        name.textContent = displayName(host);

        const urlContainer = document.createElement('div');
        urlContainer.className = 'shortcut-url';

        const urlLink = document.createElement('a');
        urlLink.href = url;
        urlLink.target = '_blank';
        urlLink.rel = 'noopener noreferrer';
        urlLink.className = 'shortcut-url-link';
        urlLink.textContent = url;
        urlLink.title = url;

        urlContainer.appendChild(urlLink);
        info.appendChild(name);
        info.appendChild(urlContainer);
        content.appendChild(icon);
        content.appendChild(info);

        const actions = document.createElement('div');
        actions.className = 'shortcut-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'btn-edit';
        editBtn.setAttribute('aria-label', `Edit shortcut ${displayName(host)}`);
        editBtn.setAttribute('title', 'Edit shortcut');
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => {
            editingHost = host;
            renderMappings();
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.setAttribute('aria-label', `Delete shortcut ${displayName(host)}`);
        deleteBtn.setAttribute('title', 'Delete shortcut');
        deleteBtn.textContent = '🗑';
        deleteBtn.addEventListener('click', () => deleteMapping(host));

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        card.appendChild(content);
        card.appendChild(actions);
        return card;
    }

    function buildEditCard(host, url) {
        const card = document.createElement('div');
        card.className = 'shortcut-card shortcut-card-editing';

        const form = document.createElement('form');
        form.className = 'shortcut-edit-form';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'shortcut-edit-input';
        nameInput.value = host;
        nameInput.setAttribute('aria-label', 'Shortcut name');

        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'shortcut-edit-input';
        urlInput.value = url;
        urlInput.setAttribute('aria-label', 'Destination URL');

        const buttons = document.createElement('div');
        buttons.className = 'shortcut-edit-buttons';

        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'btn btn-edit-save';
        saveBtn.textContent = 'Save';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-secondary btn-edit-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            editingHost = null;
            renderMappings();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveEdit(host, nameInput.value, urlInput.value);
        });
        form.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                editingHost = null;
                renderMappings();
            }
        });

        buttons.appendChild(saveBtn);
        buttons.appendChild(cancelBtn);
        form.appendChild(nameInput);
        form.appendChild(urlInput);
        form.appendChild(buttons);
        card.appendChild(form);
        setTimeout(() => nameInput.focus(), 0);
        return card;
    }

    async function saveEdit(oldHost, newHostRaw, newUrlRaw) {
        const validation = validateShortcutHost(newHostRaw);
        if (!validation.valid) {
            showMessage(validation.error, 'error');
            return;
        }
        const newHost = validation.normalized;
        const newUrl = normalizeDestinationUrl(newUrlRaw.trim());
        if (!newUrlRaw.trim()) {
            showMessage('Destination URL cannot be empty', 'error');
            return;
        }
        if (newHost !== oldHost && mappings[newHost]) {
            showMessage(`Shortcut "${displayName(newHost)}" already exists!`, 'error');
            return;
        }
        const previous = mappings;
        const updated = Object.fromEntries(
            Object.entries(mappings).filter(([key]) => key !== oldHost)
        );
        updated[newHost] = newUrl;
        mappings = updated;
        try {
            await saveMappings(mappings);
            editingHost = null;
            renderMappings();
            showMessage('Shortcut updated!', 'success');
        } catch (error) {
            mappings = previous;
            showMessage('Error updating shortcut: ' + error.message, 'error');
        }
    }

    async function deleteMapping(host) {
        if (!confirm(`Are you sure you want to delete the shortcut "${displayName(host)}"?`)) {
            return;
        }
        const previous = mappings;
        mappings = Object.fromEntries(
            Object.entries(mappings).filter(([key]) => key !== host)
        );
        try {
            await saveMappings(mappings);
            renderMappings();
            showMessage('Shortcut deleted successfully!', 'success');
        } catch (error) {
            mappings = previous;
            showMessage('Error deleting shortcut: ' + error.message, 'error');
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
            showMessage(`Shortcut "${displayName(normalizedHost)}" already exists!`, 'error');
            return false;
        }
        const previous = mappings;
        mappings = { ...mappings, [normalizedHost]: normalizedUrl };
        try {
            await saveMappings(mappings);
            renderMappings();
            const newCard = el.shortcutsList.querySelector(
                `[data-host="${CSS.escape(normalizedHost)}"]`
            );
            if (newCard) {
                newCard.classList.add('card-new');
            }
            showUsageHint(normalizedHost);
            el.shortcutHost.value = '';
            el.destinationUrl.value = '';
            lastSuggestedName = '';
            updateHostHint('');
            updateAddButtonState();
            el.shortcutHost.focus();
            chrome.storage.local.remove('pendingDestinationUrl');
            return true;
        } catch (error) {
            mappings = previous;
            showMessage('Error saving shortcut: ' + error.message, 'error');
            return false;
        }
    }

    // Replace the whole mapping set (used by import)
    async function replaceMappings(newMappings) {
        const previous = mappings;
        mappings = { ...newMappings };
        try {
            await saveMappings(mappings);
            renderMappings();
        } catch (error) {
            mappings = previous;
            throw error;
        }
    }

    // Prefill a suggested name for the given URL. Auto-suggestions are kept
    // selected so typing replaces them; user-typed text is never overwritten.
    function applySuggestedName(url) {
        const current = el.shortcutHost.value.trim();
        if (current && current !== lastSuggestedName) {
            return;
        }
        const suggestion = suggestShortcutName(url);
        if (!suggestion || mappings[suggestion]) {
            return;
        }
        el.shortcutHost.value = suggestion;
        lastSuggestedName = suggestion;
        updateHostHint(suggestion);
        updateAddButtonState();
        el.shortcutHost.focus();
        el.shortcutHost.select();
    }

    // Fill the destination field (tab prefill / context-menu capture)
    function prefillDestination(url) {
        el.destinationUrl.value = url;
        applySuggestedName(url);
        updateAddButtonState();
        el.shortcutHost.focus();
    }

    function wireEvents() {
        el.addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const host = el.shortcutHost.value.trim();
            const url = el.destinationUrl.value.trim();
            if (!host || !url) {
                showMessage('Please fill in both fields', 'error');
                return;
            }
            await addMapping(host, url);
        });
        el.shortcutHost.addEventListener('input', (e) => {
            updateHostHint(e.target.value);
            updateAddButtonState();
        });
        el.destinationUrl.addEventListener('input', updateAddButtonState);
        if (el.searchInput) {
            el.searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value.trim();
                renderMappings();
            });
        }
        chrome.storage.onChanged.addListener((changes, areaName) => {
            // Stay in sync when shortcuts change elsewhere (other page, another machine)
            if (areaName === 'sync' && changes.mappings) {
                mappings = changes.mappings.newValue || {};
                renderMappings();
            }
            // Re-sort when the omnibox records a use
            if (areaName === 'local' && changes.usage) {
                usage = changes.usage.newValue || {};
                if (!editingHost) {
                    renderMappings();
                }
            }
        });
    }

    function loadUsage() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['usage'], (result) => {
                resolve(result.usage || {});
            });
        });
    }

    async function init() {
        cacheElements();
        wireEvents();
        try {
            mappings = await loadMappings();
        } catch (error) {
            console.error('Error loading mappings:', error);
            mappings = {};
        }
        try {
            usage = await loadUsage();
        } catch (error) {
            console.error('Error loading usage data:', error);
            usage = {};
        }
        renderMappings();
        updateAddButtonState();
    }

    return {
        init,
        getMappings: () => ({ ...mappings }),
        replaceMappings,
        prefillDestination,
        showMessage
    };
})();
