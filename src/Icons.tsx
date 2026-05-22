import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number };

function baseProps({ size = 16, strokeWidth = 1.75, ...rest }: IconProps & { strokeWidth?: number }) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...rest,
  };
}

export function AppLogo({ size = 22, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable={false}
      {...rest}
    >
      <defs>
        <linearGradient id="acm-logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f5d06f" />
          <stop offset="55%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#a47411" />
        </linearGradient>
        <linearGradient id="acm-logo-shine" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#acm-logo-grad)" />
      <rect x="0" y="0" width="24" height="24" rx="6" fill="url(#acm-logo-shine)" />
      <rect x="5" y="5" width="6" height="6" rx="1.4" fill="#1a1408" fillOpacity="0.85" />
      <rect x="13" y="5" width="6" height="6" rx="1.4" fill="#1a1408" fillOpacity="0.35" />
      <rect x="5" y="13" width="6" height="6" rx="1.4" fill="#1a1408" fillOpacity="0.35" />
      <rect x="13" y="13" width="6" height="6" rx="1.4" fill="#1a1408" fillOpacity="0.85" />
    </svg>
  );
}

export function AppWordmark({ height = 20, ...rest }: SVGProps<SVGSVGElement> & { height?: number }) {
  return (
    <svg
      height={height}
      viewBox="0 0 192 26"
      fill="none"
      aria-label="AI Multiplexer"
      role="img"
      {...rest}
    >
      <defs>
        <linearGradient id="acm-wordmark-grad" x1="0" y1="0" x2="192" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f7d678" />
          <stop offset="40%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#8a5d0a" />
        </linearGradient>
      </defs>
      <text
        x="0"
        y="20"
        fill="url(#acm-wordmark-grad)"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="20"
        fontWeight="800"
        letterSpacing="-0.7"
      >
        AI Multiplexer
      </text>
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function IconMaximize(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <polyline points="4 9 4 4 9 4" />
      <polyline points="20 9 20 4 15 4" />
      <polyline points="4 15 4 20 9 20" />
      <polyline points="20 15 20 20 15 20" />
    </svg>
  );
}

export function IconMinimize(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <polyline points="9 4 4 4 4 9" />
      <polyline points="15 4 20 4 20 9" />
      <polyline points="9 20 4 20 4 15" />
      <polyline points="15 20 20 20 20 15" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function IconRefresh(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
