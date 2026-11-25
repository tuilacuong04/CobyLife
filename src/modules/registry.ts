import { AccentTone, ModuleId, PageId } from '../types';

export interface ModuleDefinition {
  id: ModuleId;
  pageId: PageId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  tone: AccentTone;
  defaultSub: string;
  poweredBy?: string;
}

/**
 * Pluggable Module Registry.
 * To add Module #3, #4, ... in the future:
 * 1. Add the module id to ModuleId/PageId in src/types.ts
 * 2. Register a ModuleDefinition entry here
 * 3. Mount its page component in src/App.tsx
 */
export const APP_MODULES: ModuleDefinition[] = [
  {
    id: 'tasks',
    pageId: 'tasks',
    name: 'Personal Tasks',
    shortName: 'Tasks',
    tagline: 'Agenda, Kanban & checklists',
    description:
      'Organize daily personal tasks with Agenda, drag-and-drop Kanban board, priorities, categories, subtasks, pinning, and recurring schedules.',
    tone: 'sky',
    defaultSub: 'agenda',
  },
  {
    id: 'finance',
    pageId: 'finance',
    name: 'Expense Tracker',
    shortName: 'Finance',
    tagline: 'Wallets, budgets & cashflow',
    description:
      'Log expenses, income, and wallet transfers with shorthand input (50k, 1.5m), multi-wallet balances, category budgets, and 6-month cashflow charts.',
    tone: 'coral',
    defaultSub: 'overview',
  },
];

export const MODULE_MAP: Record<ModuleId, ModuleDefinition> = APP_MODULES.reduce(
  (acc, m) => {
    acc[m.id] = m;
    return acc;
  },
  {} as Record<ModuleId, ModuleDefinition>
);
