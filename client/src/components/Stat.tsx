const ICONS = {
  likes: <path d="M8 13.5S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.5-6 7.5z" />,
  plays: <path d="M5 3l8 5-8 5z" />,
  forks: (
    <>
      <circle cx="4" cy="3.2" r="1.6" />
      <circle cx="4" cy="12.8" r="1.6" />
      <circle cx="12" cy="5.2" r="1.6" />
      <path d="M4 4.8v6.4M12 6.8c0 3.4-8 1.6-8 4.4" />
    </>
  ),
};

/** Icon + number; the label is the tooltip and the accessible name. */
export function Stat({ kind, n, label }: { kind: keyof typeof ICONS; n: number; label: string }) {
  return (
    <span className="stat" title={label} aria-label={`${n} ${label}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
        {ICONS[kind]}
      </svg>
      {n}
    </span>
  );
}
