"use client";

import { Fragment, useEffect, useRef, type CSSProperties } from "react";

/**
 * Título com duas assinaturas do material bruto (`data-splash` +
 * `<em>`): a ÚLTIMA palavra (pontuação final fora do itálico, fiel ao
 * original — "nossa <em>tela</em>.") ganha destaque em itálico na cor de
 * acento; passar o mouse por cima faz cada letra saltar e trocar de cor
 * entre as cores do ciclo (`accentCycle`, sempre de `theme.paleta` —
 * nunca hex fixo). A quebra em letras/hover só roda no client, com
 * ponteiro fino e sem prefers-reduced-motion (mesmo padrão de
 * CustomCursor.tsx: setState/DOM mutation adiada, nunca no corpo síncrono
 * do efeito).
 */
export function SplashTitle({
  texto,
  slot,
  as = "h2",
  className = "",
  style,
  accentCycle,
}: {
  texto?: string;
  slot?: string;
  as?: "h1" | "h2";
  className?: string;
  style?: CSSProperties;
  accentCycle: string[];
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const wrap = (node: Node) => {
      node.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim()) {
          const frag = document.createDocumentFragment();
          [...n.textContent].forEach((ch) => {
            if (ch === " ") {
              frag.appendChild(document.createTextNode(" "));
              return;
            }
            const span = document.createElement("span");
            span.textContent = ch;
            span.style.display = "inline-block";
            span.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1), color .35s";
            frag.appendChild(span);
          });
          n.parentNode?.replaceChild(frag, n);
        } else if (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName !== "BR") {
          wrap(n);
        }
      });
    };
    wrap(el);

    const letras = Array.from(el.querySelectorAll<HTMLElement>("span"));
    const onEnter = () =>
      letras.forEach((s) => {
        s.style.transform = `translateY(${(Math.random() * 10 - 5).toFixed(1)}px)`;
        s.style.color = accentCycle[(Math.random() * accentCycle.length) | 0] ?? "";
      });
    const onLeave = () =>
      letras.forEach((s) => {
        s.style.transform = "";
        s.style.color = "";
      });
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  if (!texto) return null;

  // Quebra de linha literal (ex.: título do hero em duas linhas) preservada
  // via <br/> — só a ÚLTIMA linha recebe o destaque em itálico, igual ao
  // material bruto ("Sua pele,<br/>nossa <em>tela</em>.").
  const linhas = texto.split("\n");
  const ultimaLinha = linhas.pop() ?? "";
  const anteriores = linhas.map((linha, i) => (
    <Fragment key={i}>
      {linha}
      <br />
    </Fragment>
  ));

  const palavras = ultimaLinha.trim().split(/\s+/);
  const ultima = palavras.pop() ?? "";
  const m = /^(.*?)([.,!?…]*)$/.exec(ultima);
  const palavra = m?.[1] ?? ultima;
  const pontuacao = m?.[2] ?? "";
  const inicio = palavras.length > 0 ? `${palavras.join(" ")} ` : "";

  const conteudo = (
    <>
      {anteriores}
      {inicio}
      <em className="not-italic italic" style={{ color: "var(--d-accent)" }}>
        {palavra}
      </em>
      {pontuacao}
    </>
  );

  if (as === "h1") {
    return (
      <h1 ref={ref} data-demo-slot={slot} className={className} style={style}>
        {conteudo}
      </h1>
    );
  }
  return (
    <h2 ref={ref} data-demo-slot={slot} className={className} style={style}>
      {conteudo}
    </h2>
  );
}
