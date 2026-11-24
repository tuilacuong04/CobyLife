import {
  FinanceCategory,
  FinanceWallet,
  FutureModuleIdea,
  PersistedAppState,
} from '../types';
import { addDaysIso, currentMonthKey, localIsoDate, shiftMonthKey } from '../utils/format';

export const DEFAULT_FINANCE_CATEGORIES: FinanceCategory[] = [
  { id: 'cat-food', name: 'Ăn uống', kind: 'expense', tone: 'coral', badge: 'ĂU' },
  { id: 'cat-gym', name: 'Gym & Dinh dưỡng', kind: 'expense', tone: 'lime', badge: 'GY' },
  { id: 'cat-move', name: 'Di chuyển', kind: 'expense', tone: 'sky', badge: 'DC' },
  { id: 'cat-home', name: 'Nhà cửa & Hóa đơn', kind: 'expense', tone: 'sand', badge: 'HĐ' },
  { id: 'cat-shop', name: 'Mua sắm', kind: 'expense', tone: 'coral', badge: 'MS' },
  { id: 'cat-play', name: 'Giải trí & Cafe', kind: 'expense', tone: 'sky', badge: 'GT' },
  { id: 'cat-study', name: 'Học tập & Sách', kind: 'expense', tone: 'lime', badge: 'HT' },
  { id: 'cat-other-exp', name: 'Chi phí khác', kind: 'expense', tone: 'sand', badge: 'KH' },
  { id: 'cat-salary', name: 'Lương chính', kind: 'income', tone: 'lime', badge: 'LG' },
  { id: 'cat-freelance', name: 'Freelance / Dự án', kind: 'income', tone: 'sky', badge: 'FL' },
  { id: 'cat-bonus', name: 'Thưởng / Đầu tư', kind: 'income', tone: 'sand', badge: 'ĐT' },
];

export const DEFAULT_WALLETS: FinanceWallet[] = [
  {
    id: 'w-bank',
    name: 'Tài khoản ngân hàng',
    kind: 'bank',
    initialBalance: 18500000,
    tone: 'sky',
    note: 'Tài khoản chi tiêu & nhận lương chính',
  },
  {
    id: 'w-ewallet',
    name: 'Ví điện tử (MoMo)',
    kind: 'ewallet',
    initialBalance: 2400000,
    tone: 'coral',
    note: 'Thanh toán ăn uống, cafe, gửi xe',
  },
  {
    id: 'w-cash',
    name: 'Tiền mặt',
    kind: 'cash',
    initialBalance: 1500000,
    tone: 'sand',
    note: 'Tiền mặt trong ví hằng ngày',
  },
  {
    id: 'w-save',
    name: 'Quỹ tiết kiệm',
    kind: 'savings',
    initialBalance: 35000000,
    tone: 'lime',
    note: 'Dự phòng khẩn cấp & mục tiêu dài hạn',
  },
];

export const DEFAULT_FUTURE_IDEAS: FutureModuleIdea[] = [
  {
    id: 'idea-habits',
    name: 'Thói quen hàng ngày (Habits)',
    description: 'Theo dõi chuỗi ngày uống nước, ngủ đủ giấc, đọc sách, giãn cơ mỗi sáng.',
    category: 'Lối sống',
    priority: 'high',
    tone: 'lime',
  },
  {
    id: 'idea-nutrition',
    name: 'Dinh dưỡng & Calories / Macro',
    description: 'Tính lượng protein, carbs, calories theo ngày để kết hợp trực tiếp với lịch tập Gym.',
    category: 'Sức khỏe',
    priority: 'high',
    tone: 'sky',
  },
  {
    id: 'idea-notes',
    name: 'Ghi chú cá nhân (Second Brain)',
    description: 'Sổ tay Markdown lưu nhanh ý tưởng, kiến thức học được và link hữu ích.',
    category: 'Tri thức',
    priority: 'medium',
    tone: 'sand',
  },
  {
    id: 'idea-reading',
    name: 'Sách & Khóa học',
    description: 'Quản lý tiến độ sách đang đọc, ghi chú chương hay và mục tiêu học tập.',
    category: 'Phát triển bản thân',
    priority: 'low',
    tone: 'coral',
  },
];

function monthDay(monthKey: string, day: number): string {
  const safeDay = Math.min(Math.max(1, day), 28);
  return `${monthKey}-${String(safeDay).padStart(2, '0')}`;
}

export function createStarterState(): PersistedAppState {
  const today = localIsoDate();
  const curM = currentMonthKey();
  const prev1 = shiftMonthKey(curM, -1);
  const prev2 = shiftMonthKey(curM, -2);
  const prev3 = shiftMonthKey(curM, -3);

  return {
    version: 1,
    tasks: [
      {
        id: 't-1',
        title: 'Hoàn thành buổi tập Push Day & cập nhật mức tạ',
        notes: 'Mở module Gym (openGym) để ghi lại set/rep Bench Press và Incline Dumbbell Press.',
        status: 'doing',
        priority: 'high',
        category: 'health',
        dueDate: today,
        dueTime: '18:00',
        recurrence: 'weekly',
        pinned: true,
        subtasks: [
          { id: 'st-1', title: 'Khởi động vai & cổ tay 10 phút', done: true },
          { id: 'st-2', title: 'Ghi log 4 bài chính trong openGym', done: false },
          { id: 'st-3', title: 'Bổ sung 35g protein sau tập', done: false },
        ],
        createdAt: addDaysIso(today, -2),
      },
      {
        id: 't-2',
        title: 'Tổng kết chi tiêu tuần & kiểm tra ngân sách ăn uống',
        notes: 'Đối chiếu số dư ví MoMo và tài khoản ngân hàng xem có bị lệch không.',
        status: 'todo',
        priority: 'medium',
        category: 'finance',
        dueDate: today,
        dueTime: '21:00',
        recurrence: 'weekly',
        pinned: false,
        subtasks: [
          { id: 'st-4', title: 'Nhập các khoản ăn trưa & cafe chưa ghi', done: false },
          { id: 'st-5', title: 'Kiểm tra hạn mức ngân sách tháng này', done: false },
        ],
        createdAt: addDaysIso(today, -1),
      },
      {
        id: 't-3',
        title: 'Review tiến độ dự án cá nhân & dọn hộp thư',
        notes: 'Ưu tiên xử lý các mục quan trọng trước 11h sáng.',
        status: 'todo',
        priority: 'high',
        category: 'work',
        dueDate: today,
        dueTime: '10:30',
        recurrence: 'daily',
        pinned: true,
        subtasks: [],
        createdAt: addDaysIso(today, -3),
      },
      {
        id: 't-4',
        title: 'Mua thêm Whey Protein & yến mạch cho tuần tới',
        notes: 'Kiểm tra giá trước khi đặt hàng, ghi vào danh mục Gym & Dinh dưỡng.',
        status: 'todo',
        priority: 'medium',
        category: 'health',
        dueDate: addDaysIso(today, 2),
        recurrence: 'monthly',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -1),
      },
      {
        id: 't-5',
        title: 'Đọc 20 trang sách & ghi chú 3 ý chính',
        notes: 'Duy trì thói quen đọc trước khi ngủ 30 phút.',
        status: 'todo',
        priority: 'low',
        category: 'study',
        dueDate: addDaysIso(today, 1),
        dueTime: '22:00',
        recurrence: 'daily',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -4),
      },
      {
        id: 't-6',
        title: 'Thanh toán tiền điện nước & internet tháng này',
        notes: 'Chuyển khoản tự động qua tài khoản ngân hàng.',
        status: 'done',
        priority: 'high',
        category: 'finance',
        dueDate: addDaysIso(today, -2),
        recurrence: 'monthly',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -7),
        completedAt: addDaysIso(today, -2),
      },
      {
        id: 't-7',
        title: 'Cập nhật cân nặng & số đo cơ thể đầu tuần',
        notes: 'Đo vào buổi sáng sau khi ngủ dậy để theo dõi xu hướng chính xác.',
        status: 'done',
        priority: 'medium',
        category: 'personal',
        dueDate: addDaysIso(today, -1),
        recurrence: 'weekly',
        pinned: false,
        subtasks: [],
        createdAt: addDaysIso(today, -5),
        completedAt: addDaysIso(today, -1),
      },
    ],
    finance: {
      wallets: DEFAULT_WALLETS,
      categories: DEFAULT_FINANCE_CATEGORIES,
      budgets: [
        { categoryId: 'cat-food', monthlyLimit: 4500000 },
        { categoryId: 'cat-gym', monthlyLimit: 2200000 },
        { categoryId: 'cat-move', monthlyLimit: 1200000 },
        { categoryId: 'cat-home', monthlyLimit: 4000000 },
        { categoryId: 'cat-play', monthlyLimit: 1500000 },
        { categoryId: 'cat-shop', monthlyLimit: 2000000 },
      ],
      transactions: [
        // Current month
        { id: 'tx-1', type: 'income', amount: 24000000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(curM, 1), note: 'Lương tháng này' },
        { id: 'tx-2', type: 'expense', amount: 3800000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(curM, 2), note: 'Tiền nhà & điện nước' },
        { id: 'tx-3', type: 'expense', amount: 1250000, categoryId: 'cat-gym', walletId: 'w-bank', date: monthDay(curM, 3), note: 'Whey Isolate + Creatine' },
        { id: 'tx-4', type: 'transfer', amount: 5000000, categoryId: 'cat-other-exp', walletId: 'w-bank', toWalletId: 'w-save', date: monthDay(curM, 4), note: 'Trích tiết kiệm đầu tháng' },
        { id: 'tx-5', type: 'expense', amount: 650000, categoryId: 'cat-food', walletId: 'w-ewallet', date: addDaysIso(today, -4), note: 'Đi siêu thị ức gà, trứng, rau xanh' },
        { id: 'tx-6', type: 'expense', amount: 185000, categoryId: 'cat-move', walletId: 'w-cash', date: addDaysIso(today, -3), note: 'Đổ xăng & gửi xe' },
        { id: 'tx-7', type: 'expense', amount: 95000, categoryId: 'cat-play', walletId: 'w-ewallet', date: addDaysIso(today, -2), note: 'Cafe làm việc cuối tuần' },
        { id: 'tx-8', type: 'expense', amount: 140000, categoryId: 'cat-food', walletId: 'w-ewallet', date: addDaysIso(today, -1), note: 'Cơm trưa & bữa phụ trước tập' },
        { id: 'tx-9', type: 'income', amount: 3500000, categoryId: 'cat-freelance', walletId: 'w-bank', date: addDaysIso(today, -2), note: 'Thanh toán job freelance' },
        { id: 'tx-10', type: 'expense', amount: 55000, categoryId: 'cat-food', walletId: 'w-cash', date: today, note: 'Ăn sáng & cà phê đen' },
        // Previous month 1
        { id: 'tx-p1-1', type: 'income', amount: 24000000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(prev1, 1), note: 'Lương tháng trước' },
        { id: 'tx-p1-2', type: 'expense', amount: 3900000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(prev1, 3), note: 'Tiền nhà & hóa đơn' },
        { id: 'tx-p1-3', type: 'expense', amount: 4100000, categoryId: 'cat-food', walletId: 'w-ewallet', date: monthDay(prev1, 14), note: 'Chi tiêu ăn uống trong tháng' },
        { id: 'tx-p1-4', type: 'expense', amount: 1650000, categoryId: 'cat-gym', walletId: 'w-bank', date: monthDay(prev1, 10), note: 'Gói tập gym + thực phẩm bổ sung' },
        { id: 'tx-p1-5', type: 'expense', amount: 1450000, categoryId: 'cat-shop', walletId: 'w-bank', date: monthDay(prev1, 19), note: 'Quần áo tập & phụ kiện' },
        { id: 'tx-p1-6', type: 'expense', amount: 980000, categoryId: 'cat-move', walletId: 'w-cash', date: monthDay(prev1, 22), note: 'Di chuyển trong tháng' },
        // Previous month 2
        { id: 'tx-p2-1', type: 'income', amount: 25500000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(prev2, 1), note: 'Lương + thưởng nhẹ' },
        { id: 'tx-p2-2', type: 'expense', amount: 3850000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(prev2, 4), note: 'Tiền nhà & internet' },
        { id: 'tx-p2-3', type: 'expense', amount: 3750000, categoryId: 'cat-food', walletId: 'w-ewallet', date: monthDay(prev2, 15), note: 'Ăn uống hằng ngày' },
        { id: 'tx-p2-4', type: 'expense', amount: 1900000, categoryId: 'cat-gym', walletId: 'w-bank', date: monthDay(prev2, 11), note: 'Gym & Whey' },
        { id: 'tx-p2-5', type: 'expense', amount: 1320000, categoryId: 'cat-play', walletId: 'w-ewallet', date: monthDay(prev2, 21), note: 'Gặp gỡ bạn bè & giải trí' },
        // Previous month 3
        { id: 'tx-p3-1', type: 'income', amount: 23500000, categoryId: 'cat-salary', walletId: 'w-bank', date: monthDay(prev3, 1), note: 'Lương tháng' },
        { id: 'tx-p3-2', type: 'expense', amount: 3700000, categoryId: 'cat-home', walletId: 'w-bank', date: monthDay(prev3, 5), note: 'Tiền nhà & dịch vụ' },
        { id: 'tx-p3-3', type: 'expense', amount: 4300000, categoryId: 'cat-food', walletId: 'w-ewallet', date: monthDay(prev3, 16), note: 'Ăn uống & thực phẩm' },
        { id: 'tx-p3-4', type: 'expense', amount: 1100000, categoryId: 'cat-study', walletId: 'w-bank', date: monthDay(prev3, 18), note: 'Mua sách & khóa học online' },
        { id: 'tx-p3-5', type: 'expense', amount: 1200000, categoryId: 'cat-move', walletId: 'w-cash', date: monthDay(prev3, 24), note: 'Xăng xe & di chuyển' },
      ],
    },
    futureModules: DEFAULT_FUTURE_IDEAS,
    settings: {
      theme: 'dark',
      currency: 'VND',
      weekStartsOn: 'monday',
      pinEnabled: false,
      pinCode: '1234',
      profile: {
        name: 'Cường',
        tagline: 'Personal Life OS · Gym · Tasks · Finance',
        avatar: '/images/rep-luca.svg',
      },
      enabledModules: {
        gym: true,
        tasks: true,
        finance: true,
      },
    },
  };
}

export function createEmptyPersonalState(): PersistedAppState {
  const base = createStarterState();
  return {
    ...base,
    tasks: [],
    finance: {
      wallets: [
        { id: 'w-bank', name: 'Tài khoản ngân hàng', kind: 'bank', initialBalance: 0, tone: 'sky' },
        { id: 'w-cash', name: 'Tiền mặt', kind: 'cash', initialBalance: 0, tone: 'sand' },
      ],
      categories: DEFAULT_FINANCE_CATEGORIES,
      transactions: [],
      budgets: [],
    },
  };
}
