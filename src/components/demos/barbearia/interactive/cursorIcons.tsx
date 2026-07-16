/** Ícones do cursor contextual — portados do material bruto (components/svg/*). */

export function RazorIcon({ color }: { color: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 18 C 4 15, 8 16, 12 17 C 14 17.5, 17 19, 19 18" />
      <circle cx="12" cy="17" r="1" fill={color} stroke="none" />
      <path d="M12 17 L 18 8 L 22 10 L 16 19 Z" fill={`${color}20`} />
    </svg>
  );
}

export function CombIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6 H 20 V 9 H 4 Z" fill={`${color}20`} />
      <line x1="6" y1="9" x2="6" y2="18" />
      <line x1="8" y1="9" x2="8" y2="18" />
      <line x1="10" y1="9" x2="10" y2="18" />
      <line x1="12" y1="9" x2="12" y2="18" />
      <line x1="14" y1="9" x2="14" y2="18" />
      <line x1="16" y1="9" x2="16" y2="18" />
      <line x1="18" y1="9" x2="18" y2="18" />
    </svg>
  );
}

export function ShavingMachineIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 8 C 8 5, 16 5, 16 8 L 14 19 C 14 20, 10 20, 10 19 Z" fill={`${color}15`} />
      <path d="M6 5 H 18 V 7 H 6 Z" fill={`${color}40`} />
      <line x1="7" y1="5" x2="7" y2="3" />
      <line x1="9" y1="5" x2="9" y2="3" />
      <line x1="11" y1="5" x2="11" y2="3" />
      <line x1="13" y1="5" x2="13" y2="3" />
      <line x1="15" y1="5" x2="15" y2="3" />
      <line x1="17" y1="5" x2="17" y2="3" />
      <circle cx="12" cy="12" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

export function OpenScissorsIcon({ color }: { color: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="rotate(-15, 8, 12)">
        <path d="M4 14 A 2 2 0 1 0 4 18 A 2 2 0 1 0 4 14 Z M 6 16 L 22 4" />
      </g>
      <g transform="rotate(15, 8, 12)">
        <path d="M4 4 A 2 2 0 1 0 4 8 A 2 2 0 1 0 4 4 Z M 6 8 L 22 20" />
      </g>
      <circle cx="8" cy="12" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}
