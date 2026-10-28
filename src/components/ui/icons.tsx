/** The few icons the page uses, drawn in one 2px rounded stroke. Decorative: the text beside them carries the meaning. */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const CloseIcon = ({ className = "size-5" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/** "Opens somewhere else": live sites, code, profiles. */
export const OutIcon = ({ className = "size-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M8 16L16 8M9 8h7v7" />
  </svg>
);

export const DownIcon = ({ className = "size-4" }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);
