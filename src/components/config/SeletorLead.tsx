"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api-client";
import type { OpcaoLead } from "@/lib/leads/selecao";

/**
 * O SELETOR DE LEAD — um componente só, para todo campo da /config que
 * precisa de um `leadId`.
 *
 * **O problema que ele resolve**: vários campos pediam o id cru, e o id de
 * um lead é o placeId do Google ("ChIJ…", quase 30 caracteres) que não
 * aparece — de propósito — em lugar nenhum da interface. O operador não
 * tinha como preencher. A saída NÃO é espalhar ids pela tela (isso
 * desfaria a arrumação do colapso da /config); é o campo parar de pedir id
 * e passar a pedir LEAD. O valor gravado continua sendo o `leadId`:
 * nenhuma mudança de modelo de dados.
 *
 * **Uma requisição por abertura, nunca uma por tecla.** O `AppDb` não tem
 * query, então "procurar por nome" no servidor seria a varredura de
 * `/leads` inteira a cada letra digitada. A lista vem UMA vez, quando o
 * seletor abre (e fica em memória enquanto o componente vive); o filtro é
 * local, sobre o que já está em mãos.
 *
 * **Fica em arquivo próprio, e não em `comum.tsx`**, apesar de três
 * painéis o usarem: aquele arquivo é de campos BURROS — um `<input>`
 * controlado, commit no blur, nenhuma I/O. Este busca, guarda, filtra e
 * abre um painel flutuante; enterrá-lo lá tornaria ilegíveis as peças de
 * uma linha que moram naquele arquivo.
 */

/** O `valor` que significa "nenhum lead escolhido". */
const VAZIO = "";

/** Quantas linhas a lista DESENHA — o filtro enxerga todas. */
const LINHAS_MAX = 50;

/** Sem acento e sem caixa: "José" tem que casar com "jose". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** O que a resolução por id devolveu, junto do id que a pediu. */
interface Resolvida {
  leadId: string;
  opcao: OpcaoLead | null;
  /** A requisição falhou — diferente de "o lead não existe mais". */
  falhou: boolean;
}

export function SeletorLead({
  valor,
  onEscolher,
  extras,
  disabled = false,
  permiteVazio = false,
  rotuloVazio = "escolher lead…",
  ariaLabel,
  nome,
}: {
  /** O `leadId` gravado. `""` = nenhum. */
  valor: string;
  onEscolher: (leadId: string) => void;
  /**
   * Opções que a LISTA não traz, oferecidas mesmo assim. Hoje é o lead
   * fixo de teste: `listLeads` o exclui na ORIGEM para ele não vazar para
   * /leads, /demos, /hoje, /mundo e para a penetração por nicho — e a
   * correção de o disparo de teste precisar dele é esta, no seletor, nunca
   * afrouxar aquela exclusão.
   */
  extras?: OpcaoLead[];
  disabled?: boolean;
  /** Oferece "nenhum" como escolha — para campo onde vazio é desligado. */
  permiteVazio?: boolean;
  rotuloVazio?: string;
  ariaLabel: string;
  /** Gancho dos laços de captura (`data-seletor`). */
  nome: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<OpcaoLead[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [resolvida, setResolvida] = useState<Resolvida | null>(null);

  const caixa = useRef<HTMLDivElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);

  const listaExtras = useMemo(() => extras ?? [], [extras]);

  /** O lead escolhido, quando ele já está em mãos sem custar requisição. */
  const local =
    valor === VAZIO
      ? null
      : (listaExtras.find((o) => o.leadId === valor) ??
        lista?.find((o) => o.leadId === valor) ??
        null);

  const precisaResolver = valor !== VAZIO && local === null;

  /**
   * UM id já gravado tem que aparecer pelo NOME assim que o painel abre —
   * e o corpo de um painel fechado continua montado, então isto roda no
   * carregamento da /config. Por isso é `getLeadSelecao` (UMA leitura de
   * documento) e não a lista: a varredura fica para quando o seletor abre.
   *
   * A resposta carrega o id que a pediu: trocar de lead enquanto a
   * anterior estava no ar não pode fazer o nome antigo aparecer no lugar
   * do novo. Busca declarada DENTRO do efeito — ver "Padrão de fetch em
   * useEffect" no ARCHITECTURE.md.
   */
  useEffect(() => {
    if (!precisaResolver) return;
    let ignore = false;
    api
      .getLeadSelecao(valor)
      .then(({ lead }) => {
        if (!ignore) setResolvida({ leadId: valor, opcao: lead, falhou: false });
      })
      .catch(() => {
        if (!ignore) setResolvida({ leadId: valor, opcao: null, falhou: true });
      });
    return () => {
      ignore = true;
    };
  }, [valor, precisaResolver]);

  /** Fecha no Esc e no clique fora — os dois jeitos de desistir. */
  useEffect(() => {
    if (!aberto) return;
    const noDocumento = (evento: MouseEvent) => {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    };
    const naTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", noDocumento);
    document.addEventListener("keydown", naTecla);
    return () => {
      document.removeEventListener("mousedown", noDocumento);
      document.removeEventListener("keydown", naTecla);
    };
  }, [aberto]);

  /** Abrir põe o cursor na busca: quem abriu vai digitar um nome. */
  useEffect(() => {
    if (aberto) campoBusca.current?.focus();
  }, [aberto]);

  /**
   * A ÚNICA requisição de lista, e ela é de EVENTO (não de efeito): só
   * acontece quando alguém abre, e só na primeira vez. Reabrir reusa o que
   * já veio — e digitar não chega nem perto daqui.
   */
  function abrir() {
    if (disabled) return;
    setAberto((estava) => !estava);
    if (lista !== null || carregando) return;
    setCarregando(true);
    setErroLista(null);
    api
      .getLeadsSelecao()
      .then(({ leads }) => setLista(leads))
      .catch(() => setErroLista("Falha ao carregar os leads."))
      .finally(() => setCarregando(false));
  }

  function escolher(leadId: string) {
    setAberto(false);
    setBusca("");
    if (leadId !== valor) onEscolher(leadId);
  }

  /** Tudo que pode ser escolhido: os extras primeiro, sem repetir id. */
  const opcoes = useMemo(() => {
    const daLista = (lista ?? []).filter(
      (o) => !listaExtras.some((extra) => extra.leadId === o.leadId),
    );
    return [...listaExtras, ...daLista];
  }, [lista, listaExtras]);

  /** O FILTRO — local, sobre a lista já carregada. Nenhuma rede aqui. */
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (termo === "") return opcoes;
    return opcoes.filter((o) => normalizar(`${o.nome} ${o.cidade} ${o.nicho}`).includes(termo));
  }, [opcoes, busca]);

  const mostradas = filtradas.slice(0, LINHAS_MAX);

  const escolhida = local ?? (resolvida?.leadId === valor ? resolvida.opcao : null);
  const naoEncontrada = valor !== VAZIO && !escolhida && resolvida?.leadId === valor;

  return (
    <div ref={caixa} data-seletor={nome} className="relative min-w-[12rem] flex-1">
      <button
        type="button"
        onClick={abrir}
        disabled={disabled}
        aria-expanded={aberto}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2 rounded border border-line bg-surface-2 px-2 py-1 text-left text-xs text-foreground outline-none focus:border-accent disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          {valor === VAZIO ? (
            <span className="text-ink-muted">{rotuloVazio}</span>
          ) : escolhida ? (
            <>
              <span className="block truncate">{escolhida.nome}</span>
              <span className="block truncate text-[10px] text-ink-muted">
                {descricao(escolhida)}
              </span>
            </>
          ) : naoEncontrada ? (
            // A limpeza de leads antigos pode excluir justamente o lead
            // escolhido como contexto. Isso é estado previsto: diz o que
            // houve e continua abrindo, em vez de quebrar o painel.
            <span className="text-warning">
              {resolvida?.falhou ? "não deu pra carregar o nome" : "lead não encontrado"}
            </span>
          ) : (
            <span className="text-ink-muted">carregando…</span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-[10px] text-ink-muted">
          ▾
        </span>
      </button>

      {/* DESMONTA fechado, nunca `display:none`: o aferidor de "slot com
          caixa zerada" dos laços de captura existe para pegar conteúdo que
          some sem querer, e uma lista escondida viraria uma parede de
          falso positivo dentro de um painel ABERTO. */}
      {aberto && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-[50vh] overflow-auto rounded border border-line bg-surface p-1.5 shadow-lg">
          <input
            ref={campoBusca}
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="procurar por nome…"
            aria-label={`Procurar lead — ${ariaLabel}`}
            className="w-full rounded border border-line bg-surface-2 px-2 py-1 text-xs text-foreground outline-none focus:border-accent"
          />

          {carregando && <p className="px-1 py-2 text-xs text-ink-muted">carregando leads…</p>}
          {erroLista && <p className="px-1 py-2 text-xs text-critical">{erroLista}</p>}

          {!carregando && !erroLista && (
            <ul data-lista="seletor-lead" className="mt-1 flex flex-col">
              {permiteVazio && busca.trim() === "" && (
                <li>
                  <button
                    type="button"
                    onClick={() => escolher(VAZIO)}
                    className="w-full rounded px-1.5 py-1 text-left text-xs text-ink-muted hover:bg-surface-2"
                  >
                    nenhum
                  </button>
                </li>
              )}
              {mostradas.map((opcao) => (
                <li key={opcao.leadId}>
                  <button
                    type="button"
                    onClick={() => escolher(opcao.leadId)}
                    aria-current={opcao.leadId === valor}
                    className={`w-full rounded px-1.5 py-1 text-left hover:bg-surface-2 ${
                      opcao.leadId === valor ? "bg-accent/10" : ""
                    }`}
                  >
                    <span className="block truncate text-xs text-foreground">{opcao.nome}</span>
                    <span className="block truncate text-[10px] text-ink-muted">
                      {descricao(opcao)}
                    </span>
                  </button>
                </li>
              ))}
              {mostradas.length === 0 && (
                <li className="px-1.5 py-2 text-xs text-ink-muted">
                  {opcoes.length === 0 ? "Nenhum lead na base." : "Nenhum lead com esse nome."}
                </li>
              )}
            </ul>
          )}

          {filtradas.length > mostradas.length && (
            <p className="px-1.5 pt-1 text-[10px] text-ink-muted">
              mostrando {mostradas.length} de {filtradas.length} — refine a busca
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A linha de baixo de cada opção: nicho, cidade e se tem demo.
 *
 * Os três juntos, e não só o nome, porque é isso que distingue DOIS LEADS
 * DE MESMO NOME em cidades diferentes — o caso em que uma lista só de
 * nomes faz o operador escolher o errado sem perceber. "sem demo" é dito
 * porque é ele que decide se o lead serve de alvo de disparo.
 */
function descricao(opcao: OpcaoLead): string {
  return [opcao.nicho, opcao.cidade, opcao.temDemo ? "com demo" : "sem demo"]
    .filter((parte) => parte !== "")
    .join(" · ");
}
