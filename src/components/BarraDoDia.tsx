import {
  horaDoMinuto,
  horaParaExibicao,
  linhaEstadoContato,
  marcasDaBarra,
  ROTULO_NIVEL,
  type BarraDoDia as BarraDoDiaDados,
} from "@/lib/leads/barraDoDia";
import type { FaixaNivelContato, NivelContato } from "@/lib/leads/janelaContato";

/**
 * A BARRA DO DIA da ficha do lead: o expediente de hoje pintado nos três
 * níveis da família (ver `lib/leads/barraDoDia.ts`), com o marcador da hora
 * ATUAL em hora local do LEAD.
 *
 * Cinco decisões que não são estéticas:
 *
 * 1. **Cor nunca é o único canal** (regra de legibilidade do projeto): cada
 *    nível tem também uma ALTURA própria (bom preenche a barra inteira,
 *    razoável pela metade, ruim uma tira baixa), a legenda repete os três em
 *    palavras, cada trecho tem `title` com hora e nível, a barra inteira tem
 *    `aria-label` descrevendo a sequência, e a linha de texto abaixo diz o
 *    estado atual sem depender de nada visual.
 * 2. **Fora do expediente não se pinta nada.** O buraco entre dois trechos
 *    (fechado pro almoço, por exemplo) é o próprio fundo da trilha. Vermelho
 *    quer dizer "aberto, mas hora ruim" — pintar o fechado de vermelho
 *    repetiria com cor o que a ausência já diz.
 * 3. **Altura fixa, sempre.** Todas as peças têm altura reservada desde o
 *    primeiro desenho (a linha de texto reserva duas linhas), então o
 *    horário de funcionamento chegando DEPOIS (botão "buscar horários") só
 *    troca o conteúdo dos trechos — nunca empurra o que está abaixo. Ver
 *    ARCHITECTURE.md, "Deslocamento de layout".
 * 4. **Hora dupla quando os fusos divergem.** `offsetUsuarioMinutos` (padrão
 *    = o do próprio lead, ou seja, sem hora dupla) é o fuso de quem está
 *    logado — vindo diferente, tanto o `title` do marcador quanto a linha de
 *    texto abaixo passam a mostrar as DUAS horas ("19h em Zurique · 15h
 *    aqui"), nunca o mesmo número repetido (`horaParaExibicao`, em
 *    `lib/leads/barraDoDia.ts`).
 * 5. **A régua ganha marcas de hora entre os extremos** (`marcasDaBarra`,
 *    mesmo arquivo): de 2 em 2h (3 em 3h se o expediente passar de 12h,
 *    pra não apertar numa régua de ~390px), MAIS a hora exata de cada troca
 *    de faixa (nível mudando, ou entrando/saindo de um buraco) — sempre em
 *    hora local do LEAD, nunca a dupla (essa continua só no `title` do
 *    marcador de agora e na linha de texto abaixo). Perto demais pra caber,
 *    a marca de TRANSIÇÃO vence a regular.
 */

/** Altura do preenchimento por nível, dentro da trilha — o segundo canal, junto da cor. */
const ALTURA_NIVEL: Record<NivelContato, string> = {
  bom: "h-full",
  razoavel: "h-[58%]",
  ruim: "h-[32%]",
};

const COR_NIVEL: Record<NivelContato, string> = {
  bom: "bg-good",
  razoavel: "bg-warning",
  ruim: "bg-critical",
};

/** Mesma escada de altura da barra, em miniatura — a legenda ensina o código. */
const ALTURA_LEGENDA: Record<NivelContato, string> = {
  bom: "h-3",
  razoavel: "h-2",
  ruim: "h-1",
};

function porcentagem(minuto: number, inicio: number, fim: number): number {
  if (fim <= inicio) return 0;
  return ((minuto - inicio) / (fim - inicio)) * 100;
}

function Legenda() {
  return (
    <ul className="mt-1.5 flex h-4 items-end gap-3 text-[11px] text-ink-muted">
      {(["bom", "razoavel", "ruim"] as const).map((nivel) => (
        <li key={nivel} className="flex items-end gap-1">
          <span className={`w-2 rounded-sm ${ALTURA_LEGENDA[nivel]} ${COR_NIVEL[nivel]}`} aria-hidden />
          <span className="leading-none">{ROTULO_NIVEL[nivel]}</span>
        </li>
      ))}
    </ul>
  );
}

export function BarraDoDia({
  barra,
  offsetUsuarioMinutos = barra.offsetMinutos,
  nomeLead,
}: {
  barra: BarraDoDiaDados;
  /** Fuso de quem está logado (ver `@/lib/fusoUsuario`) — padrão = o do próprio lead (sem hora dupla). */
  offsetUsuarioMinutos?: number;
  /** Cidade do lead, para rotular o lado dele na hora dupla ("19h em Zurique"). */
  nomeLead?: string;
}) {
  const abertura = barra.abertura;
  const marcadorPct =
    abertura && barra.minutoAgora >= abertura.inicio && barra.minutoAgora <= abertura.fim
      ? porcentagem(barra.minutoAgora, abertura.inicio, abertura.fim)
      : undefined;
  // O marcador de agora é o ponto onde a barra RESPONDE "que horas são" —
  // por isso é ele (e não um trecho qualquer da trilha) que carrega a hora
  // dupla no title, quando o fuso de quem está logado diverge do lead.
  const marcadorTitulo =
    marcadorPct !== undefined
      ? `Agora: ${horaParaExibicao(barra.minutoAgora, barra.offsetMinutos, offsetUsuarioMinutos, nomeLead)}`
      : undefined;

  const descricao = abertura
    ? `Barra do dia, hora local do lead, de ${horaDoMinuto(abertura.inicio)} a ${horaDoMinuto(abertura.fim)}: ${barra.segmentos
        .map(
          (s) => `${horaDoMinuto(s.inicioMin)} a ${horaDoMinuto(s.fimMin)} ${ROTULO_NIVEL[s.nivel]}`,
        )
        .join("; ")}.`
    : "Estabelecimento fechado hoje — nenhuma faixa a mostrar.";

  const marcas = marcasDaBarra(barra);

  return (
    <div>
      <div className="relative h-3.5 text-[10px] leading-none text-ink-muted">
        {abertura && (
          <>
            <span className="absolute left-0 top-0">{horaDoMinuto(abertura.inicio)}</span>
            <span className="absolute right-0 top-0">{horaDoMinuto(abertura.fim)}</span>
            {marcas.map((marca) => (
              <span
                key={marca.minuto}
                className={`absolute top-0 -translate-x-1/2 ${marca.transicao ? "font-medium text-ink-secondary" : ""}`}
                style={{ left: `${porcentagem(marca.minuto, abertura.inicio, abertura.fim)}%` }}
                aria-hidden
              >
                {marca.rotulo}
              </span>
            ))}
          </>
        )}
        {marcadorPct !== undefined && (
          <span
            className="absolute top-0 -translate-x-1/2 text-foreground"
            style={{ left: `${marcadorPct}%` }}
            title={marcadorTitulo}
            aria-hidden
          >
            ▼
          </span>
        )}
      </div>

      <div
        role="img"
        aria-label={descricao}
        className="relative h-7 overflow-hidden rounded border border-line bg-surface-2"
      >
        {abertura &&
          barra.segmentos.map((segmento) => (
            <span
              key={`${segmento.inicioMin}-${segmento.fimMin}`}
              title={`${horaDoMinuto(segmento.inicioMin)}–${horaDoMinuto(segmento.fimMin)}: ${ROTULO_NIVEL[segmento.nivel]}`}
              className={`absolute bottom-0 ${ALTURA_NIVEL[segmento.nivel]} ${COR_NIVEL[segmento.nivel]}`}
              style={{
                left: `${porcentagem(segmento.inicioMin, abertura.inicio, abertura.fim)}%`,
                width: `${porcentagem(segmento.fimMin, abertura.inicio, abertura.fim) - porcentagem(segmento.inicioMin, abertura.inicio, abertura.fim)}%`,
              }}
            />
          ))}
        {!abertura && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-ink-muted">
            fechado hoje
          </span>
        )}
        {marcadorPct !== undefined && (
          <span
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
            style={{ left: `${marcadorPct}%` }}
            title={marcadorTitulo}
            aria-hidden
          />
        )}
      </div>

      <Legenda />

      {/* Duas linhas reservadas: o texto muda de tamanho quando o horário de
          funcionamento chega, e não pode empurrar o que vem abaixo. */}
      <p className="mt-1 min-h-8 text-xs text-ink-secondary">
        {linhaEstadoContato(barra, offsetUsuarioMinutos, nomeLead)}
      </p>
    </div>
  );
}

/**
 * Prévia das faixas de UMA família num dia, sobre as 24h — sem lead, sem
 * horário de funcionamento. É o que /config mostra enquanto se edita: as
 * mesmas cores e alturas que a ficha vai usar.
 */
export function BarraFaixasPreview({
  faixas,
  className = "",
}: {
  faixas: FaixaNivelContato[];
  className?: string;
}) {
  const MIN_DIA = 1440;
  return (
    <div className={className}>
      <div className="relative h-4 overflow-hidden rounded border border-line bg-surface-2">
        {faixas.map((faixa, i) => {
          const inicio = faixa.inicio.hora * 60 + faixa.inicio.minuto;
          const fim = faixa.fim.hora * 60 + faixa.fim.minuto;
          if (fim <= inicio) return null;
          return (
            <span
              key={i}
              title={`${horaDoMinuto(inicio)}–${horaDoMinuto(fim)}: ${ROTULO_NIVEL[faixa.nivel]}`}
              className={`absolute bottom-0 ${ALTURA_NIVEL[faixa.nivel]} ${COR_NIVEL[faixa.nivel]}`}
              style={{ left: `${(inicio / MIN_DIA) * 100}%`, width: `${((fim - inicio) / MIN_DIA) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] leading-none text-ink-muted">
        <span>0h</span>
        <span>12h</span>
        <span>24h</span>
      </div>
    </div>
  );
}
