export function BuckLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Buckle Down"
    >
      <defs>
        <linearGradient id="buckHeadGrad" x1="32" y1="14" x2="32" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {/* Left antler — main stem + two branches */}
      <path
        d="M23 22 L19 12 M19 12 L15 7 M19 12 L23 9 M19 12 L17 16"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Right antler */}
      <path
        d="M41 22 L45 12 M45 12 L49 7 M45 12 L41 9 M45 12 L47 16"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Ears */}
      <ellipse cx="20" cy="24" rx="4" ry="5.5" fill="currentColor" opacity="0.85" />
      <ellipse cx="44" cy="24" rx="4" ry="5.5" fill="currentColor" opacity="0.85" />
      {/* Head */}
      <ellipse cx="32" cy="36" rx="13" ry="14" fill="url(#buckHeadGrad)" />
      {/* Snout */}
      <ellipse cx="32" cy="44" rx="6.5" ry="5" fill="var(--color-background)" opacity="0.22" />
      {/* Eyes */}
      <circle cx="27" cy="33" r="2" fill="var(--color-background)" />
      <circle cx="37" cy="33" r="2" fill="var(--color-background)" />
      {/* Eye highlights */}
      <circle cx="27.8" cy="32.2" r="0.7" fill="var(--color-background)" opacity="0.6" />
      <circle cx="37.8" cy="32.2" r="0.7" fill="var(--color-background)" opacity="0.6" />
      {/* Nose */}
      <ellipse cx="32" cy="42" rx="1.8" ry="1.3" fill="var(--color-background)" opacity="0.7" />
    </svg>
  );
}
