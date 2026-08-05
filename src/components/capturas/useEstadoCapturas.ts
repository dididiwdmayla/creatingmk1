"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import { estadoVisivel, type LeadCapturas } from "@/lib/demos/capturas/estado";

/**
 * Acompanhamento da geração de capturas SEM o operador recarregar nada.
 *
 * A execução acontece num runner do GitHub e leva minutos — não existe
 * conexão aberta entre o Radar e o workflow, então o estado é perguntado
 * de tempos em tempos. Só enquanto há algo em andamento: assim que todos
 * os leads pedidos chegam a um estado terminal, o laço para sozinho e a
 * tela deixa de custar request.
 *
 * O relógio do `estadoVisivel` avança junto com cada pergunta, então uma
 * geração que ficou sem notícia vira falha visível sem precisar de nada
 * além do próprio laço.
 */

/** Rápido no começo (a maioria termina rápido), calmo depois. */
const INTERVALO_INICIAL_MS = 4000;
const INTERVALO_LONGO_MS = 12000;
const PERGUNTAS_RAPIDAS = 15;

export interface EstadoCapturasHook {
  /** placeId → estado gravado (null = nunca gerou). */
  mapa: Record<string, LeadCapturas | null>;
  /**
   * Instante da última resposta, em ms. É o relógio que `estadoVisivel`
   * usa: amarrar a detecção de "sem notícia" ao momento em que o dado
   * chegou (e não a cada pintura) mantém o render puro e faz o estado
   * envelhecer junto com a informação, não com a tela.
   */
  agora: number;
  /** A geração está configurada no servidor? (sem token não adianta oferecer o botão) */
  disponivel: boolean;
  /**
   * Já veio a primeira resposta? Evita piscar "Sem capturas" num lead que
   * já tem. Lista vazia conta como carregada — não há o que esperar.
   */
  carregado: boolean;
  /** Pergunta agora e reinicia o laço — chamado logo após enfileirar. */
  recarregar: () => void;
}

export function useEstadoCapturas(ids: string[]): EstadoCapturasHook {
  const [mapa, setMapa] = useState<Record<string, LeadCapturas | null>>({});
  const [disponivel, setDisponivel] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [agora, setAgora] = useState(0);
  const [pulso, setPulso] = useState(0);

  // A lista vira string pra ser dependência estável: um array novo a cada
  // render reiniciaria o laço em toda pintura.
  const chave = [...new Set(ids)].sort().join(",");
  const pronto = carregado || chave === "";

  const recarregar = useCallback(() => setPulso((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let perguntas = 0;

    // Declarada DENTRO do efeito de propósito: o linter do React Compiler
    // recusa chamar, de dentro de um efeito, função de escopo externo que
    // atualize estado (ver "Padrão de fetch em useEffect" no ARCHITECTURE).
    const perguntar = async () => {
      try {
        const resposta = await api.getEstadoCapturas(chave.split(","));
        if (!vivo) return;
        setMapa(resposta.capturas);
        setDisponivel(resposta.disponivel);
        setCarregado(true);

        const instante = Date.now();
        setAgora(instante);
        const emAndamento = Object.values(resposta.capturas).some(
          (c) => estadoVisivel(c ?? undefined, instante).acompanhar,
        );
        if (emAndamento) {
          perguntas += 1;
          timer = setTimeout(
            perguntar,
            perguntas < PERGUNTAS_RAPIDAS ? INTERVALO_INICIAL_MS : INTERVALO_LONGO_MS,
          );
        }
      } catch {
        // Acompanhar é cortesia: uma pergunta que falha não pode virar erro
        // na tela nem parar o laço — a próxima tentativa resolve.
        if (!vivo) return;
        setCarregado(true);
        timer = setTimeout(perguntar, INTERVALO_LONGO_MS);
      }
    };

    // Lista vazia (grupo sem nenhum lead com demo) não tem o que perguntar.
    if (chave) void perguntar();
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [chave, pulso]);

  return { mapa, agora, disponivel, carregado: pronto, recarregar };
}
