"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent/90 hover:-translate-y-px hover:shadow-[0_6px_16px_-6px_var(--accent)]",
  secondary:
    "bg-surface-2 text-foreground border border-line hover:bg-surface-2/70 hover:border-accent/40",
  danger: "bg-critical text-critical-ink hover:bg-critical/90",
  ghost: "text-ink-secondary hover:text-foreground",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
