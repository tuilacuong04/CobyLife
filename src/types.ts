export type ThemeMode = 'dark' | 'light';
export type WeekStart = 'monday' | 'sunday';

export type SpaceId = 'nordlys' | 'fjellgronn' | 'glod';
export type SpaceTone = 'sky' | 'lime' | 'coral';

export type DealStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type DealSource =
  | 'Website'
  | 'Referral'
  | 'Trade show'
  | 'Cold call'
  | 'Partner';

export type ContactStatus = 'Customer' | 'Prospect' | 'Cold';

export type ActivityType = 'call' | 'meeting' | 'email' | 'task';

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined';

export type AvatarTone = 'lime' | 'sky' | 'coral' | 'sand';

export interface Rep {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
  quota: number;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  city: string;
  staff: number;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  companyId: string;
  email: string;
  phone: string;
  status: ContactStatus;
  ownerId: string;
  lastTouch: string; // YYYY-MM-DD
  tone: AvatarTone;
}

export interface Deal {
  id: string;
  title: string;
  companyId: string;
  contactId?: string;
  ownerId: string;
  stage: DealStage;
  value: number;
  closeDate: string; // YYYY-MM-DD
  source: DealSource;
  notes: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  dealId?: string;
  contactId?: string;
  ownerId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationHours?: number;
  done: boolean;
}

export interface QuoteLine {
  id: string;
  item: string;
  qty: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  number: string;
  dealId: string;
  companyId: string;
  issuedDate: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  status: QuoteStatus;
  lines: QuoteLine[];
}

export interface MonthlyRevenuePoint {
  key: string; // YYYY-MM
  label: string; // Dec, Jan, ...
  won: number;
  dealsCount: number;
  closedCount: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  meta: string;
  time: string;
  read: boolean;
  kind: 'deal' | 'quote' | 'activity' | 'won';
  route?: string;
  drawer?: DrawerState;
}

export interface SpaceData {
  id: SpaceId;
  name: string;
  tagline: string;
  city: string;
  tone: SpaceTone;
  icon: 'sun' | 'leaf' | 'bolt';
  monthlyTarget: number;
  reps: Rep[];
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  quotes: Quote[];
  history: MonthlyRevenuePoint[]; // Previous 11 months (Dec..Oct)
  notifications: NotificationItem[];
}

export interface UserProfile {
  name: string;
  role: string;
  email: string;
  avatar: string;
}

export interface NotificationPrefs {
  dealsWon: boolean;
  quoteReplies: boolean;
  dueActivities: boolean;
  weeklyDigest: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  weekStartsOn: WeekStart;
  sidebarOpen: boolean;
  profile: UserProfile;
  notifications: NotificationPrefs;
}

export interface PersistedState {
  activeSpaceId: SpaceId;
  spaces: Record<SpaceId, SpaceData>;
  settings: AppSettings;
  signedIn: boolean;
}

export type PageId =
  | 'overview'
  | 'pipeline'
  | 'contacts'
  | 'activities'
  | 'quotes'
  | 'team'
  | 'reports'
  | 'settings'
  | 'help';

export type DrawerState =
  | { kind: 'deal'; id: string }
  | { kind: 'contact'; id: string }
  | { kind: 'quote'; id: string }
  | null;

export type ModalState =
  | { kind: 'search' }
  | { kind: 'shortcuts' }
  | { kind: 'new-deal'; defaultCompanyId?: string; defaultContactId?: string }
  | { kind: 'new-contact'; defaultCompanyName?: string }
  | { kind: 'new-activity'; defaultDealId?: string; defaultContactId?: string; defaultType?: ActivityType }
  | { kind: 'new-quote'; defaultDealId?: string }
  | null;

export interface ToastItem {
  id: string;
  message: string;
  undo?: () => void;
}
