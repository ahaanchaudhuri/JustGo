# JustGo

**Custom URL shortcuts in Chrome — type a name, land on the page.**

JustGo is a Chrome extension that lets you define your own shortcut keywords for any URL. Type your shortcut in the address bar, hit enter, and you're there. No more hunting through bookmarks.

---

## How It Works

1. Open the side panel (`Ctrl+.` or click the extension icon)
2. Add a shortcut — give it a name and a destination URL
3. Type the shortcut name in Chrome's address bar and go

Your shortcuts are stored locally and always available.

---

## Features

- **Instant navigation** — type a shortcut name in the address bar to jump to any URL
- **Side panel UI** — manage shortcuts without leaving your current tab (`Ctrl+.`)
- **Smart URL handling** — protocol added automatically if you leave it off
- **Persistent storage** — shortcuts saved locally via Chrome's storage API
- **Prefill on save** — opens with the current tab's URL pre-filled when adding a new shortcut

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
Open the side panel with `Ctrl+.`, enter a name and URL, hit **Add Shortcut**.

### Use a shortcut
Type the shortcut name in Chrome's address bar and press Enter.

### Manage shortcuts
Open the side panel to view, edit, or delete any of your shortcuts.

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