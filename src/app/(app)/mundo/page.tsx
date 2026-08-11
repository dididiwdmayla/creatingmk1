"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SkeletonRows } from "@/components/Skeleton";
import { ApiError, api, type MundoResponse } from "@/lib/api-client";
import { idiomaLabel } from "@/lib/idioma";
import { horaDoMinuto } from "@/lib/leads/barraDoDia";
import { cidadeDoEndereco } from "@/lib/leads/cidade";
import { formatHora } from "@/lib/leads/horarios";
import { FAMILIA_GENERICA } from "@/lib/leads/janelaContato";
import { bandeiraDoPais } from "@/lib/prospeccao/paises";

/**
 * "ONDE PROSPECTAR AGORA" — a tela da madrugada. Escolhido um nicho, ela
 * lista os países em que ESTE minuto cai numa faixa boa daquela família,
 * em hora local de cada país; quem não está em faixa boa não aparece.
 *
 * A tela é DERIVADA: fuso, faixas e índice já existem (ver
 * `@/lib/prospeccao/mundo` e `GET /api/mundo`). Montá-la não gasta nada, e
 * o único caminho que gasta continua sendo o de sempre — o botão de busca
 * em `/leads`, com `reserveQuota` no servidor. Por isso tocar num país
 * NUNCA dispara busca: ou mostra o que já existe, ou abre o formulário
 * preenchido esperando o clique.
 */

/** Escolha de nicho da sessão (por aba, não compartilhada entre colegas). */
const FAMILIA_KEY = "radar:mundo:familia";

function rotuloIdiomas(idiomas: string[]): string {
  return idiomas.map(idiomaLabel).join(" · ");
}

/** "1,8" — índice de mercado com uma casa, como no card de Precificação. */
function formatIndice(indice: number): string {
  return indice.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function rotuloEspera(minutos: number): string {
  if (minutos < 60) return `em ${minutos}min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `em ${horas}h` : `em ${horas}h${String(resto).padStart(2, "0")}`;
}

/**
 * Link do formulário de busca já preenchido com nicho e país (ver
 * "Pré-preenchimento" em /leads). O genérico não tem termo de busca —
 * manda só a região, e o operador escreve o nicho.
 */
function linkBusca(familia: string, pais: string): string {
  const params = new URLSearchParams({ regiao: pais });
  if (familia !== FAMILIA_GENERICA) params.set("nicho", familia);
  return `/leads?${params.toString()}`;
}

export default function MundoPage() {
  const router = useRouter();
  const [familia, setFamilia] = useState<string>("");
  const [dados, setDados] = useState<MundoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  /** Hora do RELÓGIO de quem está logado, no instante da carga ("aqui"). */
  const [horaAqui, setHoraAqui] = useState<string | null>(null);

  const carregar = useCallback((qual: string) => {
    return api
      .mundo(qual || undefined)
      .then((resposta) => {
        setDados(resposta);
        setFamilia(resposta.familia);
        const agora = new Date(resposta.agora);
        setHoraAqui(formatHora(agora.getHours(), agora.getMinutes()));
        setErro(null);
      })
      .catch((error) => {
        setErro(error instanceof ApiError ? error.message : "Falha ao montar a tela.");
      });
  }, []);

  useEffect(() => {
    carregar(sessionStorage.getItem(FAMILIA_KEY) ?? "");
  }, [carregar]);

  // Sem polling de propósito: a tela vale por um minuto e a aba fica aberta
  // a madrugada inteira — ficar relendo a coleção de leads em segundo plano
  // seria custo por nada. Ela se atualiza quando o olho volta pra ela.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState === "visible") {
        carregar(sessionStorage.getItem(FAMILIA_KEY) ?? "");
      }
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [carregar]);

  function trocarFamilia(nova: string) {
    setFamilia(nova);
    setAberto(null);
    sessionStorage.setItem(FAMILIA_KEY, nova);
    setDados(null);
    carregar(nova);
  }

  /**
   * O toque no país. Com lead não contatado daquele país e nicho, a linha
   * ABRE com eles — o que já foi pago vem antes de pagar de novo. Sem
   * nenhum, vai direto pro formulário de busca preenchido (que ainda
   * espera o clique de confirmação).
   */
  function tocarPais(pais: MundoResponse["paises"][number]) {
    if (pais.totalLeads > 0) {
      setAberto((atual) => (atual === pais.codigo ? null : pais.codigo));
      return;
    }
    router.push(linkBusca(familia, pais.nome));
  }

  const rotuloFamilia =
    dados?.familias.find((f) => f.id === familia)?.rotulo ?? familia;

  return (
    <div className="flex flex-col gap-4">
      <section>
        <h1 className="font-display text-2xl font-bold text-foreground">Onde prospectar agora</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Países em faixa boa neste minuto, na hora local de cada um.
        </p>
        {/* Altura reservada desde o primeiro desenho: a hora chega junto com
            a lista, e sem o placeholder ela empurraria a lista inteira. */}
        <p className="mt-0.5 h-4 text-xs text-ink-muted">
          {horaAqui ? `${horaAqui} aqui · ordem: idioma, depois índice de preço` : " "}
        </p>
      </section>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Nicho</span>
        <select
          value={familia}
          onChange={(e) => trocarFamilia(e.target.value)}
          className="w-full rounded border border-line bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        >
          {(dados?.familias ?? [{ id: familia, rotulo: rotuloFamilia }]).map((f) => (
            <option key={f.id} value={f.id}>
              {f.rotulo}
            </option>
          ))}
        </select>
      </label>

      {erro && <p className="text-sm text-critical">{erro}</p>}

      {!dados && !erro && <SkeletonRows count={4} className="h-20" />}

      {dados && dados.paises.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-sm text-ink-secondary">
            Nenhum país em faixa boa agora para {rotuloFamilia.toLowerCase()}.
          </p>
          {dados.emBreve && (
            <p className="mt-2 text-sm text-foreground">
              <span aria-hidden="true">{bandeiraDoPais(dados.emBreve.codigo)}</span>{" "}
              {dados.emBreve.nome} abre {dados.emBreve.rotuloDia} às{" "}
              {horaDoMinuto(dados.emBreve.inicioMin)} — {rotuloEspera(dados.emBreve.emMinutos)}.
            </p>
          )}
        </div>
      )}

      {dados && dados.paises.length > 0 && (
        <ul className="flex flex-col gap-2">
          {dados.paises.map((pais) => {
            const expandido = aberto === pais.codigo;
            return (
              <li key={pais.codigo} className="rounded-lg border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => tocarPais(pais)}
                  aria-expanded={pais.totalLeads > 0 ? expandido : undefined}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <span className="shrink-0 text-2xl leading-none" aria-hidden="true">
                    {bandeiraDoPais(pais.codigo)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {pais.nome}
                      </span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        índice {formatIndice(pais.indice.indice)}
                        {pais.indice.fonte === "regioes" ? ` · ${pais.indice.cidades} cid.` : " · base"}
                      </span>
                    </span>
                    <span className="truncate text-xs text-ink-secondary">
                      {pais.horaLocal} lá · boa até {horaDoMinuto(pais.faixa.fimMin)}
                    </span>
                    <span className="truncate text-xs text-ink-muted">
                      {rotuloIdiomas(pais.idiomas)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                      pais.totalLeads > 0
                        ? "bg-accent text-accent-ink"
                        : "border border-line text-ink-secondary"
                    }`}
                  >
                    {pais.totalLeads > 0 ? `${pais.totalLeads} lead(s)` : "buscar"}
                  </span>
                </button>

                {expandido && pais.totalLeads > 0 && (
                  <div className="border-t border-line px-3 pb-3 pt-2">
                    <p className="text-xs text-ink-muted">
                      Não contatados neste país e nicho — estes já estão pagos.
                    </p>
                    <ul className="mt-2 flex flex-col gap-1">
                      {pais.leads.map((lead) => (
                        <li key={lead.placeId}>
                          <Link
                            href={`/leads/${lead.placeId}`}
                            className="flex items-baseline gap-2 py-1 text-sm text-foreground hover:text-accent"
                          >
                            <span className="truncate">{lead.nome}</span>
                            {lead.endereco && (
                              <span className="shrink-0 text-xs text-ink-muted">
                                {cidadeDoEndereco(lead.endereco).cidade}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {pais.totalLeads > pais.leads.length && (
                      <p className="mt-1 text-xs text-ink-muted">
                        e mais {pais.totalLeads - pais.leads.length} não contatado(s).
                      </p>
                    )}
                    <Link
                      href={linkBusca(familia, pais.nome)}
                      className="mt-2 inline-block text-xs font-medium text-accent hover:underline"
                    >
                      Buscar mais em {pais.nome} →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
