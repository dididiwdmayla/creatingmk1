"use client";

import { createContext, useContext, useId, useState } from "react";

import { api } from "@/lib/api-client";
import { alternarPainelConfig, type PaineisConfigAbertos } from "@/lib/usuarios/preferencias";

/**
 * O invólucro de TODO painel da /config: cabeçalho próprio, linha de
 * resumo e corpo que abre e fecha.
 *
 * **O corpo continua MONTADO quando fechado** — escondido por
 * `display:none`, não desmontado. As duas razões são o item inteiro:
 *
 * 1. A linha de resumo do bloco FECHADO ("Fila de envio — Ativa · 4/15
 *    hoje") sai do estado que o próprio painel já carregou. Desmontar
 *    mataria a busca que produz esse estado, e o cabeçalho fechado voltaria
 *    a ser só um título — que é exatamente a poluição trocando de forma. A
 *    alternativa (buscar de novo só para o resumo) é requisição nova por
 *    causa de enfeite, e está descartada.
 * 2. Fechar é embalagem VISUAL: nenhum painel muda de comportamento por
 *    estar fechado. Desmontar obrigaria a separar "quem busca" de "quem
 *    desenha" nos catorze painéis, ou seja, mexer na lógica interna de cada
 *    um — o oposto do que esta extração se propõe.
 *
 * O aberto/fechado é POR USUÁRIO (`/usuarios/{id}.paineisConfigAbertos`),
 * gravação otimista no padrão do `MetaFaixa`: aplica local, dispara o PUT,
 * reverte no erro — abrir um painel não pode esperar a rede.
 */
interface EstadoPaineis {
  aberto: (id: string) => boolean;
  alternar: (id: string) => void;
}

/** Fora do provider nada abre — é o mesmo padrão do estado inicial. */
const PaineisContexto = createContext<EstadoPaineis>({
  aberto: () => false,
  alternar: () => {},
});

/**
 * `inicial` vem resolvido no SERVIDOR (ver o wrapper de `/config`), e não de
 * uma busca do cliente: com painel aberto guardado, a lista chegando depois
 * do primeiro desenho expandiria o bloco e empurraria todos os de baixo —
 * o mesmo deslocamento que fez o progresso da meta ser resolvido no
 * servidor (ver "Deslocamento de layout" no ARCHITECTURE.md). É também por
 * isso que o cliente NÃO relê a preferência: quem a muda é esta própria
 * página, e o valor do servidor já é o certo ao chegar.
 */
export function PaineisConfigProvider({
  inicial,
  children,
}: {
  inicial: PaineisConfigAbertos;
  children: React.ReactNode;
}) {
  const [abertos, setAbertos] = useState<PaineisConfigAbertos>(inicial);

  const valor: EstadoPaineis = {
    aberto: (id) => abertos.includes(id),
    alternar: (id) => {
      const anterior = abertos;
      const proximos = alternarPainelConfig(anterior, id);
      setAbertos(proximos);
      api.salvarPaineisConfig(proximos).catch(() => setAbertos(anterior));
    },
  };

  return <PaineisContexto.Provider value={valor}>{children}</PaineisContexto.Provider>;
}

/**
 * Um bloco colapsável.
 *
 * - `id` é a chave da persistência (e o gancho `data-painel` dos laços de
 *   captura); precisa ser estável, porque trocá-lo devolve o painel ao
 *   padrão fechado para quem já o tinha aberto.
 * - `resumo` é o que o cabeçalho FECHADO diz do estado — "Ativa · 4/15
 *   hoje", "3", "Nenhuma resposta esperando". Sem ele o operador teria que
 *   abrir tudo para saber o que está acontecendo. Sai sempre de estado que
 *   o painel já tem em mãos, nunca de uma busca a mais.
 * - `nivel` 2 é o painel de topo (cartão próprio); 3 é o bloco subordinado
 *   a um painel (filete acima, como a visão da fila dentro de "Fila de
 *   envio"). É só a moldura que muda — o mecanismo é o mesmo.
 * - `acoes` é o que fica AO LADO do cabeçalho, fora do botão que abre
 *   (botão dentro de botão não existe em HTML): pausar a fila, ligar a
 *   resposta automática, atualizar a visão. Continua alcançável com o bloco
 *   fechado, que é o ponto — pausar a fila não deveria custar dois cliques.
 */
export function PainelColapsavel({
  id,
  titulo,
  resumo,
  nivel = 2,
  tituloCls,
  acoes,
  dataBloco,
  children,
}: {
  id: string;
  titulo: string;
  resumo?: React.ReactNode;
  nivel?: 2 | 3;
  /**
   * Escapatória de ESTILO do título, e existe por um motivo só: "Resposta
   * automática" já era um `<h3>` pintado com o peso de um painel (caixa
   * alta, `ink-muted`) antes desta extração. Mover um bloco não é hora de
   * repintá-lo — quem quiser uniformizar a tipografia dos blocos da fila
   * faz isso como decisão própria, não de carona.
   */
  tituloCls?: string;
  acoes?: React.ReactNode;
  /** Gancho extra dos laços de QA que já existiam neste bloco. */
  dataBloco?: string;
  children: React.ReactNode;
}) {
  const { aberto, alternar } = useContext(PaineisContexto);
  const corpoId = useId();
  const estaAberto = aberto(id);

  const cls =
    tituloCls ??
    (nivel === 2
      ? "text-xs font-semibold uppercase tracking-wide text-ink-muted"
      : "text-xs font-medium text-ink-secondary");

  const cabecalho = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => alternar(id)}
        aria-expanded={estaAberto}
        aria-controls={corpoId}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className={`shrink-0 ${cls}`}>{titulo}</span>
        {resumo !== undefined && resumo !== null && resumo !== "" && (
          <span className="min-w-0 flex-1 truncate text-xs text-ink-secondary">{resumo}</span>
        )}
        <span aria-hidden className="ml-auto shrink-0 text-xs text-ink-muted">
          {estaAberto ? "▾" : "▸"}
        </span>
      </button>
      {acoes}
    </div>
  );

  // `hidden` do Tailwind (display:none) e NADA de classe de display neste
  // mesmo nó: as duas têm a mesma especificidade, e quem ganharia seria a
  // ordem do CSS gerado, não a ordem em que foram escritas.
  const corpo = (
    // `data-corpo` é o gancho dos laços de captura: o aferidor de "slot com
    // caixa zerada" existe para pegar conteúdo que SOME sem querer, e um
    // corpo fechado é conteúdo escondido de propósito — sem esta marca, todo
    // painel fechado viraria uma parede de falso positivo.
    <div
      id={corpoId}
      data-corpo={estaAberto ? "aberto" : "fechado"}
      className={estaAberto ? undefined : "hidden"}
    >
      {children}
    </div>
  );

  if (nivel === 3) {
    return (
      <div {...(dataBloco && { "data-bloco": dataBloco })} data-painel={id} className="mt-4 border-t border-line pt-3">
        <h3>{cabecalho}</h3>
        {corpo}
      </div>
    );
  }

  return (
    <section
      {...(dataBloco && { "data-bloco": dataBloco })}
      data-painel={id}
      className="rounded-lg border border-line bg-surface p-4"
    >
      <h2>{cabecalho}</h2>
      {corpo}
    </section>
  );
}
