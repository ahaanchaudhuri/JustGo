# Chrome Web Store Listing — JustGo

Everything you need for the Developer Dashboard submission form.

## Basics

- **Name:** JustGo
- **Category:** Productivity → Tools (or "Workflow & Planning")
- **Language:** English

## Summary (max 132 chars — shown in search results)

> Your own URL shortcuts. Type yt/ or go yt in the address bar and land anywhere instantly. Local, private, fast.

## Detailed description

```
Stop hunting through bookmarks. JustGo lets you name any URL and jump to it
straight from the address bar.

HOW IT WORKS
• Type "yt/" and press Enter — you're on YouTube. The trailing slash tells
  Chrome it's an address the first time; after that, Chrome remembers.
• Or type "go", press Tab, and search all your shortcuts with live,
  fuzzy-matched suggestions.

SAVE A SHORTCUT IN SECONDS
• Type "go add docs" in the address bar to save the page you're on — you
  never leave it. A badge flash on the toolbar icon confirms.
• Right-click any page or link → "JustGo: create shortcut".
• Or press Ctrl+. — the side panel opens with the current URL and a smart
  suggested name already filled in. Just press Enter.

POWER FEATURES
• Parameterized shortcuts: put %s in a destination
  (github.com/search?q=%s) and pass arguments — "go gh claude" or
  "gh/claude" both work.
• Fuzzy search, edit-in-place, and frecency ordering: your most-used
  shortcuts float to the top.
• Import/export as JSON. Shortcuts sync across your Chrome profiles.

PRIVATE BY DESIGN
Everything stays in your browser. No servers, no accounts, no analytics,
no data collection — see the permissions section below for exactly what
JustGo can and can't do.
```

## Permission justifications (for the review form)

- **Single purpose:** JustGo lets users define custom keyword shortcuts that
  redirect to URLs of their choosing from the browser address bar.
- **activeTab:** Reads the current tab's URL only when the user invokes the
  extension (toolbar click, keyboard shortcut, context menu, omnibox), to
  pre-fill the "new shortcut" form and power the "go add <name>" command.
- **contextMenus:** Adds "create shortcut for this page/link" items to the
  right-click menu.
- **declarativeNetRequest + host permissions (<all_urls>):** The extension
  redirects navigations to user-created shortcut names (e.g. "yt/") to the
  user's chosen destination. Chrome's declarativeNetRequest redirect rules
  require host access for the matched requests; shortcut names are
  arbitrary user-chosen words, so the match set cannot be pre-narrowed.
  JustGo registers redirect rules only for the exact shortcut names the
  user creates, never reads page content, and makes no network requests.
- **storage:** Persists the user's shortcuts (chrome.storage.sync) and
  local usage counts for sorting (chrome.storage.local).
- **sidePanel:** Hosts the shortcut manager UI.
- **Remote code:** None. No analytics, no external requests of any kind.
- **Data usage disclosure:** Does not collect or transmit any user data.

## Assets in this folder

| File | Size | Use |
|------|------|-----|
| icon128.png | 128×128 | Store icon |
| tile-small.png | 440×280 | Small promo tile |
| marquee.png | 1400×560 | Marquee promo tile (featuring) |
| shot-1-hero.png | 1280×800 | Screenshot 1 — omnibox hero |
| shot-2-manager.png | 1280×800 | Screenshot 2 — side panel manager |
| shot-3-capture.png | 1280×800 | Screenshot 3 — capture methods |

Sources for all graphics are in `src/` — edit the HTML and re-render with
headless Chrome (see repo history for the exact command).

## Submission checklist

1. Zip is at `dist/justgo-1.0.0.zip` (built from manifest + html/css/js/icons only)
2. Upload zip at https://chrome.google.com/webstore/devconsole
3. Paste summary + description above
4. Upload the three screenshots, small tile, and marquee
5. Fill permission justifications from this file
6. Data usage: select "does not collect user data"
7. Set visibility (public / unlisted) and submit for review
