import React from 'react';
import { ModuleId } from '../types';

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const base = (size: number, style?: React.CSSProperties, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  style,
  className,
  'aria-hidden': true,
});

export const IconSylvaMark: React.FC<IconProps> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5.5 16.5c0-6.2 4.6-10 12.5-10 0 6.8-3.5 11.2-9.8 11.7-1.1.1-2-.2-2.7-.7"
      fill="currentColor"
    />
    <path
      d="M6.8 17.5c2.1-2.6 4.8-5 8-6.4"
      stroke="var(--accent)"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
  </svg>
);

export const IconDumbbell: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M6.5 7.5v9M17.5 7.5v9M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
  </svg>
);

export const IconTasks: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <rect x="3.5" y="4" width="17" height="16" rx="3.5" />
    <path d="m8 10.5 2 2 4.5-4.5M8 15.5h8" />
  </svg>
);

export const IconWallet: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" />
    <path d="M15.5 12h4.5M15.5 10.5a1.5 1.5 0 0 0 0 3h4.5" />
    <circle cx="16" cy="12" r="0.6" fill="currentColor" />
  </svg>
);

export const IconModules: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" />
    <path d="M16.75 13.75v6M13.75 16.75h6" />
  </svg>
);

export const IconModuleGlyph: React.FC<{ moduleId: ModuleId; size?: number }> = ({
  moduleId,
  size = 16,
}) => {
  if (moduleId === 'gym') return <IconDumbbell size={size} />;
  if (moduleId === 'tasks') return <IconTasks size={size} />;
  return <IconWallet size={size} />;
};

export const IconSidebarToggle: React.FC<IconProps> = ({ size = 18, style, className }) => (
  <svg {...base(size, style, className)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </svg>
);

export const IconOverview: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
  </svg>
);

export const IconSettings: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.4-1.51 1Z" />
  </svg>
);

export const IconSun: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
  </svg>
);

export const IconMoon: React.FC<IconProps> = ({ size = 19, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11Z" />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconClose: React.FC<IconProps> = ({ size = 17, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconChevronLeft: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconMenu: React.FC<IconProps> = ({ size = 20, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconTrash: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20l1-13M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </svg>
);

export const IconLock: React.FC<IconProps> = ({ size = 17, style, className }) => (
  <svg {...base(size, style, className)}>
    <rect x="4" y="11" width="16" height="10" rx="2.5" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

export const IconFlame: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M12 3c.5 3-2 4.5-2 7a2.5 2.5 0 0 0 5 0c0-1.2-.5-2.2-1-3 2.8 1.5 4.5 4.2 4.5 7A6.5 6.5 0 1 1 6 11.5C6 8 9 5.5 12 3Z" />
  </svg>
);

export const IconArrowUpRight: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M7 17 17 7M9 7h8v8" />
  </svg>
);

export const IconArrowDownLeft: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M17 7 7 17M15 17H7V9" />
  </svg>
);

export const IconRepeat: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

export const IconPin: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M12 17v5M8 4h8l-1 5 2 3H7l2-3-1-5Z" />
  </svg>
);

export const IconDownload: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M12 4v11M8 11l4 4 4-4M4 19h16" />
  </svg>
);

export const IconUpload: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M12 15V4M8 8l4-4 4 4M4 19h16" />
  </svg>
);

export const IconExternal: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M14 4h6v6M10 14 20 4M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
  </svg>
);

export const IconChart: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <path d="M4 19h16M7 16v-5M12 16V7M17 16v-8" />
  </svg>
);

export const IconCalendar: React.FC<IconProps> = ({ size = 15, style, className }) => (
  <svg {...base(size, style, className)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
  </svg>
);

export const IconTarget: React.FC<IconProps> = ({ size = 16, style, className }) => (
  <svg {...base(size, style, className)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);
