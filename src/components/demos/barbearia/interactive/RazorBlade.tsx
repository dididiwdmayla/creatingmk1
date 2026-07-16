/** Navalha decorativa usada na IntroAnimation — cores fixas (steel/latão), não tema. */
export function RazorBlade({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 80" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 40 C 20 20, 100 25, 180 30 C 190 32, 200 45, 180 50 C 100 65, 20 60, 20 40 Z"
        fill="#382820"
      />
      <circle cx="40" cy="40" r="4" fill="#B8975A" />
      <circle cx="160" cy="40" r="3" fill="#B8975A" />
      <circle cx="180" cy="40" r="6" fill="#B8975A" />
      <path
        d="M180 40 L 220 20 L 290 25 L 295 40 L 280 55 C 240 50, 200 45, 180 40 Z"
        fill="url(#d-blade-gradient)"
      />
      <defs>
        <linearGradient
          id="d-blade-gradient"
          x1="180"
          y1="40"
          x2="295"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E8D9B0" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#998873" stopOpacity="0.8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
