# Coby LIFE — Workspace Agent Guide

**App:** `Coby LIFE — Personal OS: Tasks · Finance` (`React 19` + `TypeScript 5.8` + `Vite 6` + `GSAP 3.15` + `Supabase` / `GitHub Gist` + `Google Apps Script`).
**Deep Maps:** Read [HANDOFF.md](./HANDOFF.md) for product context & deployment history, and [.agents/CODEBASE_INDEX.md](./.agents/CODEBASE_INDEX.md) for full line-numbered symbols, data models, and subsystem algorithms.

---

## Non-Negotiable Rules

1. **Language Split:** Communicate with the owner (`Cuong`) in **Vietnamese**; keep all **UI copy in crisp English** while supporting **VND `₫` / USD `$`** and Vietnamese shorthand input (`50k`, `1.5m`, `1.5tr`, `45k+15k`).
2. **Keep `main` Clean:** Never commit `dist/` or `node_modules/` to `main`. Develop on feature branches + PRs into `main`. Deploy live updates to the `gh-pages` branch (`build_type: legacy` — custom GitHub Actions workflows are blocked by account billing lock).
3. **CSS Z-Index & Layout Invariants:**
   - Strictly preserve stacking order: `.main` (`10`) < `.flyers` (`30`) < mobile `.scrim` (`95`) < mobile `.side` (`98`) < `.popover` (`160`) < `.drawer-backdrop` (`200`) < `.modal-backdrop` (`250`) < `.toasts` (`400`).
   - Never raise `.flyers` above `.side` on mobile; preserve `stackFade` in `src/components/Shell.tsx` when opening mobile sidebar.
4. **Motion Invariants (`src/utils/motion.ts`):**
   - `animateClipPill` must measure layout-space `offsetLeft / offsetTop / offsetWidth / offsetHeight` (never `getBoundingClientRect` affected by scroll/transform).
   - `animateIconBounce` must animate inner `<svg>` only — never scale text buttons.
5. **Security & Secrets:** Cloud DB (`coby_cloud_db_config_v1`) and Gmail ingest secrets stay client-side in `localStorage` only; `coby_inbox_push` uses write-only `ingest_key_hash` isolated from `coby_vault`. Never commit real keys or `COBYDB:` strings.

---

## Quick File Routing Table

| Need to inspect or modify... | Go directly to |
|---|---|
| Domain types (`TaskItem`, `FinanceState`, `GmailInboxItem`, modals) | `src/types.ts` |
| Central state, routing, tasks/finance actions, 1.4s debounced sync | `src/store/AppContext.tsx` |
| `localStorage` keys (`coby_life_os_v1`) & state normalization | `src/utils/storage.ts`, `src/data/seedData.ts` |
| Supabase SQL/RPCs, GitHub Gist, `COBYDB:` pairing, GAS `Code.gs` | `src/utils/cloudDb.ts` |
| Payday cycle, `Safe to Spend`, auto-rules, split, wallet drift | `src/utils/financeEngine.ts` |
| VN bank/e-wallet/receipt Gmail parser | `src/utils/vnGmailParser.ts` |
| Money formatting (`VND`/`USD`) & `parseSmartAmount` shorthand | `src/utils/format.ts` |
| Finance UI tabs, ledger CSV, desktop quick-add & mobile FAB | `src/components/pages/FinancePage.tsx` |
| Gmail Review Inbox (`Inbox` tab) | `src/components/finance/GmailInboxView.tsx` |
| `QuickLogModal`, `GmailSetupModal`, `ReconcileWalletModal`, rules/bills/categories | `src/components/finance/FinanceModals.tsx` |
| Tasks Agenda / Kanban (`.deal-card` DnD) / All List | `src/components/pages/TasksPage.tsx` |
| Overview KPIs & Bento grid | `src/components/pages/OverviewPage.tsx` |
| Extensible Module `#3+` registry & roadmap UI | `src/modules/registry.ts`, `src/components/pages/ModulesPage.tsx` |
| Settings (Profile, Cloud DB, Appearance, PIN Lock, Data Backup) | `src/components/pages/SettingsPage.tsx` |
| Glass Shell, 240 Hz spring flyers, dock & Account popover | `src/components/Shell.tsx` |
| GSAP animations, `SlidingSegmented`, `AnimatedModal` / `AnimatedDrawer` | `src/components/Motion.tsx`, `src/utils/motion.ts` |
| Drawers, Search/Task/Tx/Wallet modals, PIN screen, Toasts | `src/components/Drawers.tsx`, `src/components/Modals.tsx`, `src/components/PinLockView.tsx`, `src/components/Toasts.tsx` |
| Smoked/Milk Glass tokens, motion rules, shell & view styles | `src/styles/tokens.css`, `src/styles/motion.css`, `src/styles/shell.css`, `src/styles/views.css` |

---

## Build & Verification Commands (Windows)
> Note: On PowerShell with ExecutionPolicy restrictions, run `npm.cmd` / `npx.cmd` (or `cmd /c "npx ..."`).

```bash
npm.cmd install
npm.cmd run dev
npx.cmd tsc && npx.cmd vite build --base /Demo_APP/
```
