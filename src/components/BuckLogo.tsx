export function BuckLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Buckle Down"
    >
      {/* Antlers */}
      <path
        d="M20 18c-3-4-6-6-9-6 1 4 3 6 5 7-3 0-5 1-7 3 4 1 7 1 10 0M44 18c3-4 6-6 9-6-1 4-3 6-5 7 3 0 5 1 7 3-4 1-7 1-10 0"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Head */}
      <path
        d="M32 16c-8 0-14 6-14 14v6c0 7 6 14 14 14s14-7 14-14v-6c0-8-6-14-14-14z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Snout */}
      <ellipse cx="32" cy="44" rx="6" ry="5" fill="var(--color-background)" opacity="0.25" />
      {/* Eyes */}
      <circle cx="26" cy="32" r="1.8" fill="var(--color-background)" />
      <circle cx="38" cy="32" r="1.8" fill="var(--color-background)" />
      {/* Nose */}
      <ellipse cx="32" cy="42" rx="1.6" ry="1.2" fill="var(--color-background)" />
    </svg>
  );
}
