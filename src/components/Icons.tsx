import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
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

export const IconSpaceGlyph: React.FC<{ icon: 'sun' | 'leaf' | 'bolt'; size?: number }> = ({
  icon,
  size = 16,
}) => {
  if (icon === 'sun') {
    return (
      <svg {...base(size)}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  if (icon === 'leaf') {
    return (
      <svg {...base(size)}>
        <path d="M5 19c0-7 5-13 14-14-1 9-7 14-14 14Z" />
        <path d="M5 19l6-6" />
      </svg>
    );
  }
  return (
    <svg {...base(size)}>
      <path d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z" />
    </svg>
  );
};

export const IconSidebarToggle: React.FC<IconProps> = ({ size = 18 }) => (
  <svg {...base(size)}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </svg>
);

export const IconOverview: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" />
  </svg>
);

export const IconPipeline: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <rect x="4" y="4" width="4" height="15" rx="1.5" />
    <rect x="10" y="4" width="4" height="10" rx="1.5" />
    <rect x="16" y="4" width="4" height="7" rx="1.5" />
  </svg>
);

export const IconContacts: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <circle cx="9.5" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.8-3.2 3.2-5 6-5s5.2 1.8 6 5" />
    <circle cx="16.5" cy="9.5" r="2.4" />
    <path d="M16.5 14.5c2 0 3.7 1.2 4.3 3.5" />
  </svg>
);

export const IconActivities: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" />
    <path d="m9 15 2 2 4-4" />
  </svg>
);

export const IconQuotes: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <path d="M6 3.5h8l4 4v13a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20.5v-15.5A1.5 1.5 0 0 1 6.5 3.5Z" />
    <path d="M14 3.5V8h4M8.5 12.5h7M8.5 16h5" />
  </svg>
);

export const IconTeam: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="8" r="3" />
    <path d="M7.5 19c.6-2.7 2.4-4 4.5-4s3.9 1.3 4.5 4" />
    <circle cx="5.5" cy="10.5" r="2" />
    <circle cx="18.5" cy="10.5" r="2" />
    <path d="M2.5 18.5c.4-1.8 1.6-2.8 3-2.8M21.5 18.5c-.4-1.8-1.6-2.8-3-2.8" />
  </svg>
);

export const IconReports: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <path d="M4 19.5h16" />
    <path d="M7 16V10M12 16V5.5M17 16v-4" />
  </svg>
);

export const IconSettings: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const IconHelp: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 3.7" />
    <circle cx="12" cy="17.2" r=".7" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSun: React.FC<IconProps> = ({ size = 18 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
  </svg>
);

export const IconMoon: React.FC<IconProps> = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ size = 16 }) => (
  <svg {...base(size)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </svg>
);

export const IconPlus: React.FC<IconProps> = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconBell: React.FC<IconProps> = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M6 9.5a6 6 0 1 1 12 0c0 5.5 2 7 2 7H4s2-1.5 2-7Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const IconClose: React.FC<IconProps> = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const IconChevronRight: React.FC<IconProps> = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const IconChevronLeft: React.FC<IconProps> = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);

export const IconChevronDown: React.FC<IconProps> = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconTarget: React.FC<IconProps> = ({ size = 15 }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCalendar: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M8 3v3M16 3v3M3.5 9.5h17" />
  </svg>
);

export const IconBuilding: React.FC<IconProps> = ({ size = 18 }) => (
  <svg {...base(size)}>
    <path d="M4 20h16M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15" />
    <path d="M10 8h1M13 8h1M10 12h1M13 12h1M10 20v-4h4v4" />
  </svg>
);

export const IconPhone: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="M5.5 4h3l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5v3a1.5 1.5 0 0 1-1.5 1.5A15.5 15.5 0 0 1 4 5.5 1.5 1.5 0 0 1 5.5 4Z" />
  </svg>
);

export const IconVideo: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <rect x="3" y="6.5" width="12.5" height="11" rx="2" />
    <path d="m15.5 10.5 5-2.5v8l-5-2.5" />
  </svg>
);

export const IconMail: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

export const IconTask: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);

export const IconSend: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5L3 9.5 21 3Z" />
  </svg>
);

export const IconDownload: React.FC<IconProps> = ({ size = 15 }) => (
  <svg {...base(size)}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M4 19h16" />
  </svg>
);

export const IconTrophy: React.FC<IconProps> = ({ size = 14 }) => (
  <svg {...base(size)}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 6H4.5a1.5 1.5 0 0 0 0 3H7M17 6h2.5a1.5 1.5 0 0 1 0 3H17" />
  </svg>
);

export const IconEye: React.FC<IconProps> = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.7" />
  </svg>
);

export const IconEyeOff: React.FC<IconProps> = ({ size = 16 }) => (
  <svg {...base(size)}>
    <path d="M3 3l18 18M10.6 10.6a2.7 2.7 0 0 0 3.8 3.8M9.9 5.2A9.8 9.8 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-3.3 4.3M6.3 6.3C4 8 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.8-.3 4-.9" />
  </svg>
);

export const IconMenu: React.FC<IconProps> = ({ size = 19 }) => (
  <svg {...base(size)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconActivityKind: React.FC<{ type: 'call' | 'meeting' | 'email' | 'task'; size?: number }> = ({
  type,
  size = 14,
}) => {
  if (type === 'call') return <IconPhone size={size} />;
  if (type === 'meeting') return <IconVideo size={size} />;
  if (type === 'email') return <IconMail size={size} />;
  return <IconTask size={size} />;
};
