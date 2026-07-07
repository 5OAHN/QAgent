// 공용 라인 아이콘 세트 — 이모지 대신 사용하는 SVG 아이콘 모음.
// 기존 코드베이스의 인라인 SVG 스타일(strokeWidth ~1.8, viewBox 24x24)에 맞춤.

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

const base = (size = 16, strokeWidth = 1.8) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function IconAlertTriangle({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

export function IconConstruction({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <rect x="2" y="14" width="20" height="4" rx="1" />
      <path d="M4 14V9l4-4M20 14V9l-4-4M8 5h8M6 18v2M18 18v2" />
    </svg>
  );
}

export function IconCheckCircle({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

export function IconXCircle({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 9l6 6m0-6l-6 6" />
    </svg>
  );
}

export function IconClock({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconCircleDashed({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
    </svg>
  );
}

export function IconPencil({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconTrash({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconKey({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.5 12.5L20 3M20 3h-4M20 3v4M17 6l2 2" />
    </svg>
  );
}

export function IconLightbulb({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 00-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0012 2z" />
    </svg>
  );
}

export function IconSparkles({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" />
    </svg>
  );
}

export function IconFlask({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M9 2v6.5L4 18a2 2 0 001.8 3h12.4a2 2 0 001.8-3l-5-9.5V2" />
      <path d="M9 2h6M7 15h10" />
    </svg>
  );
}

export function IconLock({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7.5 11V7.5a4.5 4.5 0 019 0V11" />
      <circle cx="12" cy="16" r="1.3" fill={color} stroke="none" />
    </svg>
  );
}

export function IconUserPlus({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a6 6 0 016-6h2a6 6 0 016 6v1" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

export function IconCreditCard({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

export function IconBell({ size, color = "currentColor", strokeWidth, className }: IconProps) {
  return (
    <svg {...base(size, strokeWidth)} stroke={color} className={className}>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
