"use client";

import { useEffect, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import { CAPTURAS_MAX_ANCORAS } from "@/lib/demos/capturas/ancoras";
import { medirSecao, neutralizarCromo, prepararPagina } from "@/lib/demos/capturas/dom.mjs";

/**
 * Cliente da tela de marcação (ver o comentário do page.tsx irmão).
 *
 * A prévia do enquadramento é o ponto delicado: ela precisa mostrar
 * EXATAMENTE o que o motor vai capturar, e o motor enquadra pela caixa de
 * `[data-d-secao="<id>"]`. Em vez de reimplementar essa medida em CSS
 * (que divergiria no dia em que a skin mudasse), a prévia carrega a skin
 * de verdade no harness que já existe (/interno/demo-qa) dentro de um
 * <iframe> de MESMA ORIGEM, lê a caixa da seção pelo mesmo seletor e
 * posiciona o iframe por transform. É a mesma fonte de verdade dos dois
 * lados — não tem como a prévia mentir sobre o corte.
 */

export interface SkinCatalogo {
  id: string;
  nome: string;
  nicho: string;
  secoes: Array<{ id: string; nome: string; fixa: boolean }>;
  padrao: string[];
}

/** As duas telas que o motor captura (ver scripts/capturas.mjs). */
const TELAS = [
  { id: "desktop", rotulo: "Desktop", largura: 1440, altura: 900 },
  { id: "celular", rotulo: "Celular", largura: 390, altura: 844 },
] as const;

type TelaId = (typeof TELAS)[number]["id"];

/** Caixa da prévia: largura de conforto e teto de altura na tela. */
const PREVIA_LARGURA = 320;
const PREVIA_ALTURA_MAX = 520;

export function CapturasClient({ catalogo }: { catalogo: SkinCatalogo[] }) {
  const [skinId, setSkinId] = useState(catalogo[0]?.id ?? "");
  const [tela, setTela] = useState<TelaId>("desktop");
  const [ancoras, setAncoras] = useState<Record<string, string[]> | null>(null);
  const [podeEditar, setPodeEditar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Carga inicial: marcação vigente + papel (o PUT é restrito ao admin,
  // então membro abre em leitura em vez de bater num 403 ao salvar).
  useEffect(() => {
    let vivo = true;
    Promise.all([api.getConfig(), api.me().catch(() => null)])
      .then(([{ config }, me]) => {
        if (!vivo) return;
        setAncoras(config.capturas.ancoras);
        setPodeEditar(me?.usuario.papel === "admin");
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : "falha ao carregar a marcação");
      });
    return () => {
      vivo = false;
    };
  }, []);

  const skin = catalogo.find((s) => s.id === skinId);
  const marcadas = ancoras?.[skinId] ?? skin?.padrao ?? [];

  /**
   * Alternar uma seção. A ORDEM DE ESCOLHA é a ordem das capturas — por
   * isso a seção entra no fim da lista, não na posição dela na skin.
   */
  function alternar(secaoId: string) {
    if (!podeEditar || !skin) return;
    setAviso(null);
    const atuais = ancoras?.[skinId] ?? skin.padrao;
    const proximas = atuais.includes(secaoId)
      ? atuais.filter((id) => id !== secaoId)
      : [...atuais, secaoId];
    if (proximas.length > CAPTURAS_MAX_ANCORAS) {
      setAviso(
        `Máximo de ${CAPTURAS_MAX_ANCORAS} âncoras por skin — desmarque uma antes de escolher outra.`,
      );
      return;
    }
    setAncoras({ ...(ancoras ?? {}), [skinId]: proximas });
  }

  function salvar() {
    if (!podeEditar || !ancoras) return;
    setSalvando(true);
    setErro(null);
    setAviso(null);
    api
      .putConfig({ capturas: { ancoras } })
      .then(({ config }) => {
        setAncoras(config.capturas.ancoras);
        setAviso("Marcação salva.");
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "falha ao salvar"))
      .finally(() => setSalvando(false));
  }

  function restaurarPadrao() {
    if (!podeEditar || !skin) return;
    setAviso(null);
    setAncoras({ ...(ancoras ?? {}), [skinId]: [...skin.padrao] });
  }

  return (
    <main className="min-h-screen bg-[#0b1219] p-6 text-[#e6edf3]">
      <header className="mx-auto mb-8 max-w-6xl">
        <h1 className="font-display text-2xl font-semibold">Âncoras de captura</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#8fa3b4]">
          Escolha até {CAPTURAS_MAX_ANCORAS} seções por skin. A captura enquadra a{" "}
          <strong className="text-[#e6edf3]">seção inteira, do início ao fim</strong> — a ordem em
          que você marca é a ordem em que as capturas saem. A prévia usa o preset padrão da skin:
          ela mostra o <em>enquadramento</em>, não o tema da demo de cada lead.
        </p>
        {!podeEditar && ancoras && (
          <p className="mt-3 rounded border border-[#3d4a57] bg-[#16212b] px-3 py-2 text-sm text-[#8fa3b4]">
            Somente leitura: a marcação é salva em /config, que só o admin edita.
          </p>
        )}
        {erro && (
          <p className="mt-3 rounded border border-[#7f2b2b] bg-[#2a1416] px-3 py-2 text-sm text-[#ffb4b4]">
            {erro}
          </p>
        )}
        {aviso && (
          <p className="mt-3 rounded border border-[#3d5a3d] bg-[#16251a] px-3 py-2 text-sm text-[#a8e6a8]">
            {aviso}
          </p>
        )}
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[240px_1fr]">
        {/* ── Skins ─────────────────────────────────────────────── */}
        <nav className="flex flex-col gap-1">
          {catalogo.map((s) => {
            const total = (ancoras?.[s.id] ?? s.padrao).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSkinId(s.id)}
                className={`rounded border px-3 py-2 text-left text-sm transition-colors ${
                  s.id === skinId
                    ? "border-[#4a9eff] bg-[#16212b] text-[#e6edf3]"
                    : "border-[#243240] bg-transparent text-[#8fa3b4] hover:border-[#3d4a57]"
                }`}
              >
                <span className="block font-medium">{s.nome}</span>
                <span className="text-xs text-[#6b7f92]">
                  {s.nicho} · {total} de {CAPTURAS_MAX_ANCORAS}
                </span>
              </button>
            );
          })}
        </nav>

        <section>
          {!ancoras && <p className="text-sm text-[#8fa3b4]">Carregando a marcação…</p>}

          {skin && ancoras && (
            <>
              {/* ── Seções disponíveis ────────────────────────── */}
              <div className="mb-6 flex flex-wrap gap-2">
                {skin.secoes.map((secao) => {
                  const posicao = marcadas.indexOf(secao.id);
                  const marcada = posicao >= 0;
                  return (
                    <button
                      key={secao.id}
                      type="button"
                      disabled={!podeEditar}
                      onClick={() => alternar(secao.id)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        marcada
                          ? "border-[#4a9eff] bg-[#16273a] text-[#cfe6ff]"
                          : "border-[#243240] text-[#8fa3b4] enabled:hover:border-[#3d4a57]"
                      }`}
                    >
                      {marcada && (
                        <span className="mr-1.5 font-mono text-xs text-[#4a9eff]">
                          {posicao + 1}
                        </span>
                      )}
                      {secao.nome}
                    </button>
                  );
                })}
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded border border-[#243240] p-1">
                  {TELAS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTela(t.id)}
                      className={`rounded px-3 py-1 text-sm ${
                        t.id === tela ? "bg-[#16273a] text-[#cfe6ff]" : "text-[#8fa3b4]"
                      }`}
                    >
                      {t.rotulo} · {t.largura}px
                    </button>
                  ))}
                </div>
                {podeEditar && (
                  <>
                    <button
                      type="button"
                      onClick={salvar}
                      disabled={salvando}
                      className="rounded bg-[#4a9eff] px-4 py-1.5 text-sm font-medium text-[#04121f] disabled:opacity-60"
                    >
                      {salvando ? "Salvando…" : "Salvar marcação"}
                    </button>
                    <button
                      type="button"
                      onClick={restaurarPadrao}
                      className="rounded border border-[#243240] px-3 py-1.5 text-sm text-[#8fa3b4]"
                    >
                      Restaurar padrão desta skin
                    </button>
                  </>
                )}
              </div>

              {/* ── Prévia do enquadramento ───────────────────── */}
              {marcadas.length === 0 ? (
                <p className="rounded border border-dashed border-[#243240] px-4 py-8 text-center text-sm text-[#6b7f92]">
                  Nenhuma seção marcada — esta skin não gera captura.
                </p>
              ) : (
                <div className="flex flex-wrap items-start gap-6">
                  {marcadas.map((secaoId, i) => (
                    <PreviaEnquadramento
                      key={`${skinId}-${secaoId}-${tela}`}
                      skinId={skinId}
                      secaoId={secaoId}
                      nome={skin.secoes.find((s) => s.id === secaoId)?.nome ?? secaoId}
                      ordem={i + 1}
                      largura={TELAS.find((t) => t.id === tela)!.largura}
                      altura={TELAS.find((t) => t.id === tela)!.altura}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/**
 * Uma prévia: o harness da skin num iframe, deslocado e escalado para
 * mostrar exatamente a seção marcada.
 *
 * DUAS PASSADAS, e a razão é uma armadilha achada na primeira captura
 * desta tela: esticar o iframe até a altura do documento (o jeito óbvio de
 * ter tudo "em vista" de uma vez) muda o que `100vh` significa lá dentro.
 * O hero de toda skin é `min-h-screen`, então ele passou a medir 7737px em
 * vez de 900 — a prévia enquadrava o documento inteiro e chamava aquilo de
 * hero.
 *
 *   1ª passada, iframe na altura REAL da tela: rola até o fim e volta (é o
 *      que dispara as revelações `whileInView` e o lazy-load do
 *      `next/image`) e mede a caixa da seção. Esta é a medida VERDADEIRA,
 *      a mesma que o motor de captura vai usar.
 *   2ª passada, só se a seção não couber numa tela: cresce o iframe pra
 *      conseguir MOSTRAR a seção inteira. Aqui o hero volta a inchar e
 *      empurra tudo pra baixo, então o TOPO é remedido; a ALTURA exibida
 *      continua sendo a da 1ª passada, e se ela mudou (seção que também
 *      depende de `vh`) a prévia avisa em vez de mentir.
 */
function PreviaEnquadramento({
  skinId,
  secaoId,
  nome,
  ordem,
  largura,
  altura,
}: {
  skinId: string;
  secaoId: string;
  nome: string;
  ordem: number;
  /** Largura da tela que o motor captura (1440 desktop / 390 celular). */
  largura: number;
  /** Altura REAL dessa tela — é o que faz `100vh` valer o que deve. */
  altura: number;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [medida, setMedida] = useState<{
    altura: number;
    alturaIframe: number;
    esticou: boolean;
  } | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  // `intro=0` desliga a splash de abertura: ela cobriria a página inteira
  // e a medida sairia da tela de abertura, não da seção.
  const alvo = `/interno/demo-qa?skin=${encodeURIComponent(skinId)}&intro=0`;

  function medir() {
    const iframe = ref.current;
    const win = iframe?.contentWindow;
    if (!iframe || !win) {
      setFalha("prévia indisponível");
      return;
    }
    const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Exatamente o preparo, a medida e a neutralização de cromo que o
    // motor de captura roda — o MESMO módulo, chamado aqui na janela do
    // iframe. É o que impede a prévia de prometer um enquadramento
    // diferente do que a captura entrega.
    prepararPagina({ alturaTela: altura }, win)
      .then(async () => {
        // 1ª passada, altura real da tela: só aqui `100vh` vale o que deve.
        const verdadeira = medirSecao(secaoId, win);
        if (!verdadeira) {
          setFalha(`a skin não renderizou a seção "${secaoId}" (oculta no exemplo?)`);
          return;
        }
        neutralizarCromo(secaoId, win);

        // 2ª passada, SÓ quando a seção não cabe numa tela: o iframe cresce
        // pra conseguir MOSTRÁ-LA inteira (o motor não precisa disso — ele
        // captura além da viewport sem redimensionar nada). O topo é
        // remedido porque o hero (`min-h-screen`) cresce junto e empurra o
        // resto pra baixo; a altura exibida continua sendo a verdadeira.
        const cabe = verdadeira.altura <= altura;
        const alturaIframe = cabe ? altura : Math.ceil(verdadeira.altura);
        let depois = verdadeira;
        if (!cabe) {
          iframe.style.height = `${alturaIframe}px`;
          await espera(600);
          depois = medirSecao(secaoId, win) ?? verdadeira;
        }

        // Posicionar é ROLAR O DOCUMENTO DE DENTRO, não transladar o
        // elemento: um iframe pinta só a própria viewport, então deslocar a
        // caixa por transform deixava tudo abaixo da primeira tela em
        // branco (era o que a primeira captura desta tela mostrou — hero
        // certo, Serviços e Depoimentos vazios).
        win.scrollTo(0, depois.topo);
        await espera(300);

        setMedida({
          altura: verdadeira.altura,
          alturaIframe,
          esticou: !cabe && Math.abs(depois.altura - verdadeira.altura) > 2,
        });
      })
      .catch(() => setFalha("prévia indisponível"));
  }

  // A escala serve a dois limites ao mesmo tempo: a largura de conforto do
  // cartão e um teto de altura na tela. Seção muito alta encolhe mais, mas
  // aparece INTEIRA — é isso que a prévia tem que provar.
  const escala = medida
    ? Math.min(PREVIA_LARGURA / largura, PREVIA_ALTURA_MAX / Math.max(medida.altura, 1))
    : PREVIA_LARGURA / largura;

  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-xs text-[#4a9eff]">{String(ordem).padStart(2, "0")}</span>
        <span className="text-sm text-[#e6edf3]">{nome}</span>
      </figcaption>
      <div
        className="relative overflow-hidden rounded border border-[#243240] bg-[#0b1219]"
        style={{
          width: medida ? largura * escala : PREVIA_LARGURA,
          height: medida ? medida.altura * escala : 220,
        }}
      >
        <iframe
          ref={ref}
          src={alvo}
          title={`Prévia de ${nome}`}
          onLoad={medir}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute left-0 top-0 border-0"
          style={{
            width: largura,
            height: medida?.alturaIframe ?? altura,
            transformOrigin: "top left",
            // Só escala: o alinhamento vertical já foi feito rolando o
            // documento de dentro até o topo da seção (ver `medir`).
            transform: `scale(${escala})`,
            visibility: medida ? "visible" : "hidden",
          }}
        />
        {!medida && !falha && (
          <span className="absolute inset-0 grid place-items-center text-xs text-[#6b7f92]">
            medindo o enquadramento…
          </span>
        )}
        {falha && (
          <span className="absolute inset-0 grid place-items-center px-3 text-center text-xs text-[#ffb4b4]">
            {falha}
          </span>
        )}
      </div>
      {medida && (
        <p className="mt-1.5 font-mono text-[11px] text-[#6b7f92]">
          {largura} × {Math.round(medida.altura)} px · {(medida.altura / largura).toFixed(2)}× a
          largura
          {medida.esticou && (
            <span className="block text-[#e0b050]">
              seção depende de vh: a prévia estica pra caber, a medida acima é a real
            </span>
          )}
        </p>
      )}
    </figure>
  );
}
