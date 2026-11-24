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
 * To add Module #4, #5, ... in the future:
 * 1. Add the module id to ModuleId/PageId in src/types.ts
 * 2. Register a ModuleDefinition entry here
 * 3. Mount its page component in src/App.tsx
 */
export const APP_MODULES: ModuleDefinition[] = [
  {
    id: 'gym',
    pageId: 'gym',
    name: 'Gym & Tập luyện',
    shortName: 'Gym',
    tagline: 'openGym đầy đủ 5.600+ bài tập',
    description:
      'Tích hợp trọn vẹn openGym: lịch tập, ghi log set/rep/tạ, hẹn giờ nghỉ, tiến trình tăng tạ, bản đồ cơ bắp, đo cơ thể, thống kê 1RM & import Strong/Hevy.',
    tone: 'lime',
    defaultSub: 'home',
    poweredBy: 'openGym (AGPL-3.0)',
  },
  {
    id: 'tasks',
    pageId: 'tasks',
    name: 'Task cá nhân',
    shortName: 'Tasks',
    tagline: 'Lịch trình, Kanban & checklist',
    description:
      'Quản lý công việc hàng ngày theo Agenda, bảng Kanban kéo thả, độ ưu tiên, dự án cá nhân, subtasks và lặp lại định kỳ.',
    tone: 'sky',
    defaultSub: 'agenda',
  },
  {
    id: 'finance',
    pageId: 'finance',
    name: 'Quản lí chi tiêu',
    shortName: 'Chi tiêu',
    tagline: 'Ví tiền, ngân sách & dòng tiền',
    description:
      'Ghi chép thu chi nhanh (hỗ trợ 50k / 1.5tr), quản lý nhiều ví, đặt hạn mức ngân sách theo danh mục và theo dõi biểu đồ 6 tháng.',
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
