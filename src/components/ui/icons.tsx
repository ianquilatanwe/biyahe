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

/** A speaker: sound waves when on, a cross when off. */
export const SoundIcon = ({ on, className = "size-4" }: IconProps & { on: boolean }) => (
  <svg {...base} className={className}>
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    {on ? <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" /> : <path d="M16 10l4 4M20 10l-4 4" />}
  </svg>
);
