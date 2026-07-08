# AI Context: xiao xiong ji zhang (Bear Accounting)

## 1. Project Summary

- **Purpose**: Personal finance / expense tracking PWA. Users record income/expense transactions, view monthly summaries, and analyze spending by category.
- **Target platform**: iPhone Safari, added to home screen as standalone PWA. Works in any modern mobile browser.
- **Tech stack**: Vanilla JavaScript (ES Modules), IndexedDB, Service Worker API, CSS3 custom properties, HTML5. Zero frameworks, zero build tools, zero npm dependencies.
- **Current status**: Core MVP complete. Four views (Dashboard, Transactions, Analytics, Settings). Fully offline-capable. All data persisted locally.

## 2. Directory Structure

```
BILLAPP/
-- index.html           # SPA entry point, app shell HTML
-- manifest.json        # PWA web app manifest
-- server.js            # Development HTTP server (Node.js)
-- start.bat            # Windows batch launcher
-- AI_CONTEXT.md        # This file
-- css/
    +-- app.css           # All styles, dark mode, offline indicator
-- js/
    +-- db.js             # IndexedDB data layer (ES Module)
    +-- app.js            # App logic, routing, views, UI (ES Module)
-- icons/
    +-- icon-192.png      # PWA icon 192x192
    +-- icon-512.png      # PWA icon 512x512
    +-- icon-1024.png     # PWA icon 1024x1024 (maskable)
```

## 3. Architecture

- **UI**: SPA with four tab-based views (sections toggled via CSS display: none/block and fade-in animation). FAB opens a bottom-sheet modal for adding transactions. All views render by setting innerHTML - no virtual DOM.
- **Routing**: Manual hash-based routing. navigateTo(viewName) switches the active view class and tab-bar state. location.hash is read once on init for deep-linking.
- **Business logic**: Contained in app.js. Each view has a render*() async function that queries IndexedDB, builds HTML strings, and inserts into the DOM. Global state lives in a plain appState object.
- **Repository / Data Access**: db.js exports async CRUD functions. All IndexedDB interactions are Promise-wrapped. No ORM.
- **Database**: IndexedDB (browser-native, offline-first). Schema is versioned and seeded with 15 default categories + default settings on first creation.
- **PWA**: Service Worker uses cache-first for static assets, network-first with SPA fallback for navigation. Pre-caches all shell files on install. Broadcasts online/offline status to the app via postMessage. App shows a green/red indicator dot and toast on connectivity change.

## 4. Database

Single IndexedDB BillAppDB (version 1) with four object stores:

### transactions

- id (autoIncrement, primary key)
- type (string: 'income' / 'expense', indexed)
- category (string, references categories.name, indexed)
- amount (number)
- date (string YYYY-MM-DD, indexed)
- note (string)
- createdAt (number timestamp, indexed)
- Composite index: type_date on [type, date]

### categories

- id (autoIncrement, primary key)
- name (string)
- type (string: 'income' / 'expense', indexed)
- icon (string, emoji)
- color (string, hex)

Seeded with 15 defaults: 10 expense (Dining, Transport, Shopping, Housing, Entertainment, Medical, Education, Communication, Social, Other) + 5 income (Salary, Part-time, Investment, Red envelope, Other).

### budgets

- id (autoIncrement, primary key)
- category (string, indexed)
- amount (number)
- month (string YYYY-MM, indexed)

### settings

- key (string, primary key - NOT autoIncrement)
- value (any)

Defaults: { currency: '\u00a5', firstDayOfMonth: 1 }

## 5. File Index

- index.html: App shell - header, 4 views, tab bar, FAB, add-transaction modal, module script loader, iOS meta tags
- manifest.json: PWA manifest - name, icons, display, theme color, orientation, scope
- css/app.css: All styles - iOS-native UI, light/dark themes, safe-area, responsive layout, fonts, offline indicator
- js/app.js: Entry point - routing, view rendering, modal control, toast, online/offline detection, event binding, SW registration
- js/db.js: Data layer - schema init with seed data, CRUD for all stores, monthly summary aggregation, export/clear
- sw.js: Service Worker - cache-first for assets, network-first with SPA fallback for navigation, online status broadcast
- server.js: Dev server - correct MIME types, CORS, SPA fallback, EADDRINUSE error handling
- start.bat: Windows batch file that finds and runs the bundled Node.js
- icons/icon-*.png: Three bear-face icons on blue background (generated with Pillow)

## 6. Key Dependencies

Zero external dependencies. All functionality uses browser native APIs:

- Local storage: IndexedDB
- Offline support: Service Worker + Cache Storage API
- PWA install: Web App Manifest + iOS meta tags
- Dev server: Node.js http + fs (bundled with Codex runtime)
- Icon generation: Python Pillow (used once, not a runtime dep)

## 7. Current Features

- Dashboard (balance, expense breakdown bars, recent 5 items): Done - app.js, index.html
- Transaction list (monthly, type filter, tap to edit): Done - app.js, index.html
- Add/Edit transaction (bottom-sheet modal, type toggle, category grid, date, note): Done - app.js
- Delete transaction (with confirm dialog): Done - app.js
- Analytics (monthly stats, 6-month trend chart, category ranking): Done - app.js
- Settings (currency switcher, JSON export, data reset): Done - app.js
- 15 default categories with emoji + color: Done - db.js
- Dark mode (system preference): Done - css/app.css
- Cache-first offline SW with SPA fallback: Done - sw.js
- Online/offline detection (indicator dot + toast): Done - app.js, css/app.css
- PWA manifest + iOS meta tags: Done - index.html, manifest.json
- SW lifecycle (skipWaiting, update notification): Done - app.js, sw.js
- 6-month CSS trend chart: Done - app.js (renderAnalytics)
- Data export to JSON file: Done - app.js (exportData)
- Budget CRUD (no UI): TODO - db.js has APIs
- Data import from JSON: TODO - app.js (stub only)
- Category management UI: TODO - db.js has APIs, no UI
- Transaction search/filter: TODO - Not implemented
- Recurring transactions: TODO - Not implemented
- Budget progress tracking UI: TODO - Not implemented
- Canvas/chart library charts: TODO - CSS bars only
- iOS splash screen: Partial - only one device size
- Automated tests: TODO - None
- Multi-currency exchange rates: TODO - Symbol-only
- Accessibility (VoiceOver, Dynamic Type): TODO - Not implemented

## 8. Known Issues

- No tests: Zero test infrastructure. Manual testing only.
- Data import stub: importData() opens a file picker but says "coming soon". No restore logic.
- Budget UI missing: db.js has setBudget / getBudgetForMonth but no view to use them.
- Category management UI missing: db.js has addCategory / updateCategory / deleteCategory but no settings UI.
- Module side effect: openDB().then(...) at db.js bottom auto-runs on import. Works but implicit.
- No loading/error separation: Dashboard empty states start with "loading..." text. If render fails, it stays permanently.
- Garbled CSS/JS comments: Some Chinese text in comments is mojibake due to encoding during file creation. No functional impact.
- No request memoization: getCategories() and getMonthlySummary() open new transactions each time.
- Error handling gaps: Some IndexedDB cursor errors could throw unhandled exceptions.
- No CSP headers: Server doesn't set Content-Security-Policy.
- Single-tenant: All data is local-only. No auth, no sync, no remote backup.

## 9. Development Rules

- No frameworks: Vanilla JS (ES Modules) + vanilla CSS only. No React, Vue, Angular, Webpack, Vite, npm, or build step.
- ES Modules require HTTP: app.js uses import from './db.js'. Must be served via HTTP(S) - file:// will fail.
- No bundling: Each file served individually. File count kept minimal (<10 source files).
- Naming: camelCase for JS, kebab-case for CSS classes, camelCase for DB fields.
- CSS variables: All colors/spacing in :root. Dark mode only overrides variables in @media (prefers-color-scheme: dark).
- IDB pattern: Open DB once, cache reference module-globally. _getStore() and _wrapRequest() abstract transaction boilerplate.
- View pattern: Each view = one render*() async function. Full innerHTML re-render on every navigation. No diffing.
- State: Plain appState object. Direct mutation. No event bus or observable pattern.
- SW: Version cache names. Cache-first for static assets, network-first for navigation. skipWaiting + clients.claim() on activate.
- iOS PWA: All apple-mobile-web-app-* meta tags required. Handle safe-area-inset-*. Detect standalone via navigator.standalone. Support prefers-color-scheme: dark.
- Data seeding: Default categories/settings written in onupgradeneeded handler - only on first DB creation.
- No external calls: Zero HTTP requests to external servers. All data stays in the browser.
- Git: Conventional commit format (feat:, fix:). .git directory is sandbox-protected; all Git operations require approval.
- No sensitive data in source: The app stores only user financial data locally. No keys, tokens, or credentials in code.
- iPhone testing: Use server.js + localtunnel or ngrok to expose localhost to mobile devices not on the same WiFi.
