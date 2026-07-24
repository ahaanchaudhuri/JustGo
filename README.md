# JustGo

**Custom URL shortcuts in Chrome — type a name, land on the page.**

JustGo is a Chrome extension that lets you define your own shortcut keywords for any URL. Type your shortcut in the address bar, hit enter, and you're there. No more hunting through bookmarks.

---

## How It Works

1. Open the side panel (`Ctrl+.` or click the extension icon)
2. Add a shortcut — give it a short name and a destination URL
3. Use it from the address bar, two ways:
   - **Fast way:** type `yt/` (the trailing `/` tells Chrome it's an address, not a search — after the first time, Chrome remembers)
   - **Guided way:** type `go`, press `Tab`, then start typing — fuzzy-matched suggestions from your shortcuts appear as you type

Your shortcuts are stored locally and sync across your Chrome profiles.

---

## Features

- **Instant navigation** — type a shortcut name in the address bar to jump to any URL
- **Omnibox integration** — `go` + `Tab` searches your shortcuts with live suggestions
- **Parameterized shortcuts** — put `%s` in a destination (`github.com/search?q=%s`) and pass arguments: `go gh claude` or `gh/claude`
- **Edit, search, and smart ordering** — edit shortcuts in place, filter with fuzzy search, most-used shortcuts float to the top
- **Side panel UI** — manage shortcuts without leaving your current tab (`Ctrl+.` or the toolbar icon)
- **Smart URL handling** — protocol added automatically if you leave it off
- **Synced storage** — shortcuts saved via Chrome's sync storage, available on all your machines
- **Prefill on save** — opens with the current tab's URL pre-filled when adding a new shortcut
- **Right-click capture** — "create shortcut for this page" (or any link) straight from the context menu
- **Smart name suggestions** — a short, typeable name is suggested from the URL (`github.com/foo/my-repo` → `my-repo`), pre-selected so typing replaces it
- **Guided onboarding** — create and use your first shortcut within a minute of installing

---

## Installation

JustGo isn't on the Chrome Web Store yet — load it manually:

1. Clone or download this repo
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo folder
5. Pin JustGo to your toolbar

---

## Usage

### Add a shortcut
Open the side panel with `Ctrl+.` (or click the toolbar icon) — the destination is pre-filled with the page you're on and a short name is suggested, so it's usually just Enter to save. You can also right-click any page or link and choose **JustGo: create shortcut**.

### Use a shortcut
- Type the shortcut name with a trailing slash (`yt/`) in the address bar and press Enter, or
- Type `go`, press `Tab`, pick a suggestion, press Enter.

### Manage shortcuts
Open the side panel to view, edit, or delete any of your shortcuts.

---

## Privacy & Permissions

Everything stays in your browser — no servers, no analytics, no data collection.

- **`activeTab`** (not `tabs`) — JustGo can only see the current page's URL when *you* invoke it (toolbar icon, `Ctrl+.`, or the right-click menu), never your browsing in general
- **Host access** — required by Chrome's redirect API (`declarativeNetRequest`) so that typing `yt/` can be intercepted and redirected; JustGo registers redirect rules only for the shortcut names you create and never reads page content
- **`storage`** — your shortcuts, synced via your Chrome profile
- **`contextMenus`**, **`sidePanel`** — the right-click capture and management UI

---

## Tech

- Chrome Extension Manifest V3
- `declarativeNetRequest` API for URL redirect rules
- `sidePanel` API for the management UI
- `chrome.storage` for persistent local storage
- Vanilla JS, HTML, CSS — no build step, no dependencies

---

## License

MIT