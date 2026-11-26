# Coby LIFE — Project Handoff & Engineering Context

> Read this file first when resuming work in a new workspace or Antigravity account.

## 1. Product Overview & User Preferences
- **App Name:** **Coby LIFE** (`Coby LIFE — Personal OS: Tasks · Finance`)
- **Owner & Audience:** Single-user personal modular web hub for **Cuong** (`tuilacuong04`).
- **Live Production URL:** https://tuilacuong04.github.io/CobyLife/
- **Repository:** https://github.com/tuilacuong04/CobyLife (currently **Public** for free GitHub Pages)
- **Communication Language:** User prefers **Vietnamese** in chat; **UI language MUST stay crisp English** so typography/layout proportions match cleanly (while keeping full **VND `₫` / USD `$`** currency support and shorthand amount parsing like `50k`, `1.5m`, `1.5tr`).
- **Default Landing Page:** Opens straight to **`Overview`** (`/CobyLife/` → `overview`).
- **Visual Style:** Smoked Glass (Dark, default) & Milk Glass (Light) using `Plus Jakarta Sans` (`wght 400–800`, full Vietnamese `đ/Đ/₫` & OpenType `tnum` tabular figures, with `Be Vietnam Pro` fallback), lime accent `#c4ef4f`, GSAP + 240 Hz spring sidebar/dock/flyer morphs, bottom-sheet modals/drawers on mobile.
- **Note on Gym Removal:** The embedded `openGym` module was intentionally removed per user request so Coby LIFE stays lightweight, fast, and focused on Tasks + Finance + future custom modules.

---

## 2. Core Modules & Extensible Architecture
1. **Personal Tasks — `src/components/pages/TasksPage.tsx`**
   - Agenda, drag-and-drop Kanban board (`.deal-card`), and All-list view; 1-line quick-add, subtasks, pinning, priorities, categories, recurring schedules, slide-over/bottom-sheet edit drawer (`src/components/Drawers.tsx`).
2. **Personal Finance (v3 Mobile-Web + Gmail Sync) — `src/components/pages/FinancePage.tsx` + `src/components/finance/*`**
   - **Gmail Auto-Sync & Review Inbox (`GmailInboxView.tsx` + `vnGmailParser.ts`):** 24/7 Google Apps Script (`everyMinutes(5)` cron + CORS-safe `text/plain` `doPost` on-demand Mobile Web `"Sync Gmail"` button) pushing into write-only `public.coby_finance_inbox` on Supabase (zero OAuth popups on Mobile Safari/Chrome).
   - **Smart PFM Engine (`financeEngine.ts`):** Auto-Rules engine, Self-Transfer deduplication, Merchant E-Receipt enrichment (Grab/Apple/Shopee without double-counting), `Balance-After` Wallet Drift Catcher + 1-click Reconcile, Split/Reimbursable ("Ứng hộ") bill tracking, Custom Payday Cycle (`1–28`) + `Safe to Spend Today` pace bar, Recurring Bills & Subscriptions (`VND`/`USD`), Custom Categories CRUD, and zero-keyboard `000` `QuickLogModal`.
3. **Extensible Module Registry (`#3+`) — `src/modules/registry.ts` + `src/components/pages/ModulesPage.tsx`**
   - Plug future modules (e.g., Daily Habits, Second Brain Notes, Books) by adding an ID to `src/types.ts`, registering in `src/modules/registry.ts`, and mounting its page in `src/App.tsx` (and updating `MODULE_IDS` / flyer slots in `src/components/Shell.tsx` if surfaced as a top-level core space).

---

## 3. Data Persistence & Personal Cloud DB (`src/utils/cloudDb.ts`)
- **Local Storage + Durable IndexedDB:**
  - `localStorage['coby_life_os_v1']` (v3 schema; auto-migrates v2 and legacy `sylva_personal_os_v2`).
  - Automatically mirrored into **IndexedDB (`coby_life_idb`)** as a unified snapshot (`coby-life-backup-v1`) on every state change.
- **Cloud DB & Gmail Inbox Sync (`Settings → Cloud DB` + `GmailSetupModal`):**
  - Supports **Supabase PostgreSQL** (`public.coby_vault` + append-only `public.coby_finance_inbox` protected by a separate write-only `ingest_key_hash` so Google Apps Script can never read vault data or PIN) and **GitHub Private Gist** (`coby-life-db.json`).
  - Bidirectional auto-sync: debounced push (1.4s) after any Tasks/Finance/Settings change, auto-pull of vault + pending Gmail Inbox on app launch & window focus.
  - **Device Pairing (`COBYDB:...`):** 1-click *Copy device code* / *Apply code* transfers Supabase + Mobile `"Sync Gmail"` Web App config to Mobile Safari/Chrome in 1 paste. Credentials stay **only** in device `localStorage['coby_cloud_db_config_v1']`.
- **Manual Backup & PIN Lock:**
  - All-in-one JSON export/import (`coby-life-backup-YYYY-MM-DD.json`) in Account popover & `Settings → Data & Backup`.
  - Optional local PIN lock (`src/components/PinLockView.tsx`).

---

## 4. Key Architecture & Gotchas (Do Not Regress!)
1. **GitHub Pages Deployment Constraint:**
   - The user's GitHub account has custom GitHub Actions workflows blocked by a billing lock, **HOWEVER** GitHub Pages legacy deployment (`build_type: legacy`, branch `gh-pages`, job `pages-build-deployment`) runs and succeeds normally.
   - Deploy updates by pushing the built `dist/` output to `gh-pages`.
2. **Keep `main` Clean:**
   - Never commit `dist/` or `node_modules/` to `main`. Always make changes via feature branches + PRs into `main`.
3. **Mobile Sidebar & Flyers Z-Index Hierarchy:**
   - `.main`: `z-index: 10`, `.flyers`: `z-index: 30`, mobile `.scrim`: `z-index: 95`, mobile `.side`: `z-index: 98`, `.popover`: `z-index: 160`, `.drawer-backdrop`: `z-index: 200`, `.modal-backdrop`: `z-index: 250`.
   - Never raise `.flyers` above `.side` on mobile, and keep `Shell.tsx` fading the topbar stack flyers (`i < MOD_COUNT`) with `stackFade` when opening the mobile sidebar.
4. **Sliding Segmented Pills (`src/utils/motion.ts` + `src/components/Motion.tsx`):**
   - `animateClipPill` measures layout-space `offsetLeft / offsetTop / offsetWidth / offsetHeight` (immune to CSS `transform` and horizontal scrolling in `.seg` / `.tabs`).
   - `animateIconBounce` must ONLY animate inner `<svg>` icons — never scale text buttons.

---

## 5. Build & Deploy Commands

### Local Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npx tsc
npx vite build --base /CobyLife/
cp dist/index.html dist/404.html
touch dist/.nojekyll
```

### Deploy to Live GitHub Pages (`gh-pages` branch)
```bash
TMP_PAGES="/tmp/gh-pages-delta"
rm -rf "$TMP_PAGES"
git clone --depth 1 --branch gh-pages https://github.com/tuilacuong04/CobyLife.git "$TMP_PAGES"

find "$TMP_PAGES" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -R dist/. "$TMP_PAGES/"

git -C "$TMP_PAGES" add -A
git -C "$TMP_PAGES" commit -m "deploy: <short description>"
git -C "$TMP_PAGES" push origin gh-pages
rm -rf "$TMP_PAGES"
```

---

## 6. Completed History (PRs Merged on `main`)
- **PR #1:** GitHub Pages base-path routing & workflow setup.
- **PR #2–#4:** Personal OS foundation (Tasks + Finance + Modules + English UI).
- **PR #5:** Fixed mobile sidebar overlap, scrim dismiss, iOS safe-area scrolling, bottom-sheet modals/drawers, and mobile Finance/Tasks responsive polish.
- **PR #6:** Rebranded `Sylva LIFE → Coby LIFE`, redesigned Account popover, and added IndexedDB + Cloud DB Sync (Supabase PostgreSQL / GitHub Private Gist + `COBYDB:` device pairing).
- **PR #7:** Eliminated sliding segmented pill text overflow across all tabs (`Settings`, `Finance`, `Tasks`) and styled Tasks Kanban `.deal-card` surfaces.
- **PR #8:** Added `HANDOFF.md`.
- **Removed Gym (`openGym`):** Streamlined Coby LIFE around Tasks, Finance, Cloud DB Sync, and Extensible Modules.

## 7. Good Next Ideas (Pending User Request)
- Add PWA (`manifest.webmanifest` + app icons + Service Worker) for true full-screen iPhone *Add to Home Screen* launch.
- Optional mobile bottom tab bar (`Overview · Tasks · Finance · Modules`) for one-thumb navigation.
- Custom Finance categories CRUD on UI, recurring monthly bills, and custom salary-day billing cycle.
- Module #3+ (Daily Habits, Second Brain Notes, Recurring Subscriptions, etc.).
