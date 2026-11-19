import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3.2 13.9 9l5.8 1.9-5.8 1.9L12 18.6l-1.9-5.8L4.3 10.9 10.1 9z" />
      <path d="m18.6 15.4.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6z" />
    </svg>
  );
}

export function FilmIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A3.5 3.5 0 0 0 3 6.5v6A2.5 2.5 0 0 0 5.5 15" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M6.5 7l.8 12.1A1.9 1.9 0 0 0 9.2 21h5.6a1.9 1.9 0 0 0 1.9-1.9L17.5 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3v12" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 20h15" />
    </svg>
  );
}

export function CpuIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...iconProps} {...props}>
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 9.5v4.5M12 17.2v.3" />
    </svg>
  );
}
