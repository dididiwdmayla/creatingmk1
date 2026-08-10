"use client";

import type { ReactNode } from "react";

import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import type { Busca } from "@/lib/buscas/types";
import { formatDateShortSP, formatInt } from "@/lib/format";
import type { Densidade } from "@/lib/usuarios/preferencias";

/**
 * Cabeçalho de um GRUPO DE BUSCA, compartilhado por `/leads` (o grupo é a
 * seção colapsável de leads daquela busca) e `/buscas` (o grupo é o card da
 * própria busca, que dobra para virar só esta faixa).
 *
 * Ele existe porque, fechado, o grupo é a ÚNICA coisa na tela — então
 * precisa carregar sozinho tudo que identifica a busca: cor, nome, nicho e
 * região, data, autor e a contagem de leads. Duas linhas densas em vez do
 * card de seis: a primeira é o que se lê de relance (cor, nome, contagem),
 * a segunda é a procedência (nicho·sub-nicho — região · data · autor).
 *
 * A cor é sempre reforço redundante, nunca canal único (ver BUSCA_CORES):
 * o nome está escrito ao lado do ponto, e o triângulo diz o estado da
 * dobra sem depender de cor nenhuma.
 */
export function CabecalhoBusca({
  titulo,
  cor,
  busca,
  contagem,
  contagemTitulo,
  aberto,
  onToggle,
  nomes,
  onTrocarCor,
  trocandoCor,
  acoes,
  densidade = 1,
}: {
  /** Nome do grupo — o da busca, ou "Sem busca" no resto. */
  titulo: string;
  cor?: string;
  /** Busca de origem (ausente no grupo "Sem busca": não há procedência). */
  busca?: Busca;
  contagem: number;
  /** `title` da contagem — o que ela conta muda entre as duas telas. */
  contagemTitulo: string;
  aberto: boolean;
  onToggle: () => void;
  nomes: NomesUsuarios;
  /** Só em /buscas: tocar no ponto cicla a paleta e persiste. */
  onTrocarCor?: () => void;
  trocandoCor?: boolean;
  /** Ações à direita do cabeçalho (fora do botão de dobrar). */
  acoes?: ReactNode;
  /**
   * Densidade da grade em que esta faixa está (só `/buscas` usa: em
   * `/leads` o cabeçalho é de uma seção que ocupa a linha inteira, então
   * ele nunca aperta). A escada aqui é a mesma ideia do `LeadCard` — some
   * primeiro o que é procedência, depois o que é contagem —, e vale só
   * para a faixa FECHADA: busca aberta volta à densidade 1, porque ela
   * também volta a ocupar a linha inteira.
   */
  densidade?: Densidade;
}) {
  // Em 2 a procedência encolhe para nicho e região: data e autor são o
  // que menos distingue uma busca da outra na mesma tela (quase sempre o
  // mesmo autor, datas próximas) e são as primeiras a sair.
  const procedencia = busca
    ? [
        [busca.nicho, busca.subNicho].filter(Boolean).join(" · "),
        busca.regiao,
      ]
        .filter(Boolean)
        .join(" — ")
    : "";
  const autor = busca
    ? busca.userId
      ? nomeUsuario(nomes, busca.userId)
      : "autor não registrado"
    : "";
  const comProcedencia = densidade <= 2;
  const comDataEAutor = densidade === 1;
  const comContagem = densidade <= 3;
  // O selo "recorrente" some já na densidade 2: ele tem largura fixa de
  // ~68px e, numa faixa de ~170px, comia o nome inteiro — foi assim que o
  // portão de slots pegou o título em 0×20. A recorrência continua visível
  // (e alternável) na busca ABERTA, que volta à densidade 1.
  const comChips = densidade === 1;

  // `block` não é decoração: um <span> inline ignora width/height, e o
  // ponto some (caixa 0×0) assim que deixa de ser filho direto de um flex —
  // foi o que aconteceu quando ele entrou dentro do botão de trocar cor.
  const ponto = (
    <span
      aria-hidden
      data-ponto-busca=""
      className="block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: cor ?? "var(--ink-muted)" }}
    />
  );

  return (
    <div className="flex items-start gap-1.5">
      {onTrocarCor ? (
        <button
          type="button"
          onClick={onTrocarCor}
          disabled={trocandoCor}
          title="Trocar a cor da busca (cicla a paleta)"
          aria-label={`Trocar a cor da busca ${titulo}`}
          className={`flex shrink-0 rounded-full ring-2 ring-transparent transition hover:ring-[var(--ring-soft)] disabled:opacity-50 ${
            densidade <= 2 ? "mt-2 p-1" : "mt-1.5 p-0.5"
          }`}
        >
          {ponto}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberto}
        title={titulo}
        className="min-w-0 flex-1 rounded px-1 py-1.5 text-left hover:bg-surface-2"
      >
        {/* A procedência é a linha larga: contagem e ação ficam na de cima,
            senão sobram ~50px pra ela e o autor é o primeiro a ser cortado. */}
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="shrink-0 text-xs text-ink-muted">
            {aberto ? "▾" : "▸"}
          </span>
          {onTrocarCor ? null : ponto}
          {/* `min-w-0 flex-1`: `truncate` traz `overflow: hidden`, e um
              item de flex com overflow escondido pode encolher até ZERO —
              sem tomar o espaço que sobra explicitamente, o nome some
              (caixa 0×altura) assim que os chips ao lado enchem a faixa. */}
          <span
            className={`min-w-0 flex-1 truncate font-medium text-foreground ${
              densidade >= 4 ? "text-xs" : "text-sm"
            }`}
          >
            {titulo}
          </span>
          {comChips && busca?.recorrente && (
            <span
              title="Busca recorrente: o cron re-executa 1x/dia"
              className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent"
            >
              recorrente
            </span>
          )}
          {comContagem && (
            <span
              title={contagemTitulo}
              className="ml-auto shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-secondary"
            >
              {formatInt(contagem)}
            </span>
          )}
        </span>
        {busca && comProcedencia && (
          <span className="mt-0.5 line-clamp-2 block text-[11px] text-ink-muted">
            {procedencia}
            {comDataEAutor && (
              <>
                {" "}
                <span aria-hidden>·</span> {formatDateShortSP(busca.criadaEm)}{" "}
                <span aria-hidden>·</span> {autor}
              </>
            )}
          </span>
        )}
      </button>
      {densidade <= 2 ? acoes : null}
    </div>
  );
}
