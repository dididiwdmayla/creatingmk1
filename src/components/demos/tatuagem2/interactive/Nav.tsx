"use client";

/**
 * Nav fixa com fundo translúcido desde o início (ao contrário das outras
 * skins, o material bruto NÃO espera o usuário rolar — o blur/fundo já
 * nasce ligado), logo + ponto de pigmento (cor da seção atual, via
 * `--d-pigment` escrito por PigmentTracker) e CTA em pílula com gradiente
 * multicor que aparece no hover (`data-cta-grad` do original).
 */
export function Nav({
  nome,
  links,
  ctaHref,
  ctaLabel,
}: {
  nome: string;
  links: { href: string; label: string }[];
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--d-border)] bg-[var(--d-bg)]/72 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 md:px-[clamp(20px,4vw,56px)]">
        <a
          href="#topo"
          className="flex items-center gap-2 font-[family-name:var(--d-display)] text-2xl tracking-[0.04em] text-[var(--d-text)]"
        >
          {nome}
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full transition-colors duration-500"
            style={{ backgroundColor: "var(--d-pigment, var(--d-accent))" }}
          />
        </a>

        <nav className="hidden items-center gap-[clamp(14px,2.4vw,32px)] text-sm font-medium text-[var(--d-text)] md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-[var(--d-accent)]">
              {link.label}
            </a>
          ))}
          <a href={ctaHref} className="d-nav-cta inline-flex">
            <span className="d-nav-cta-grad" aria-hidden="true" />
            <span className="relative">{ctaLabel}</span>
          </a>
        </nav>

        <a href={ctaHref} className="d-nav-cta inline-flex text-sm md:hidden">
          <span className="d-nav-cta-grad" aria-hidden="true" />
          <span className="relative">{ctaLabel}</span>
        </a>
      </div>
    </header>
  );
}
