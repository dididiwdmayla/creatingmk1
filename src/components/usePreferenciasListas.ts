"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import {
  alternarGrupo,
  type Lista,
  type PreferenciasListas,
} from "@/lib/usuarios/preferencias";

/**
 * Preferências de compactação das listas longas (`/leads` e `/buscas`),
 * lidas do doc do usuário e gravadas de volta a cada alternância.
 *
 * `null` enquanto carrega — e as duas telas seguram a lista atrás do
 * esqueleto até resolver, de propósito: um grupo que nasce ABERTO e dobra
 * meio segundo depois é exatamente o "elemento que entra depois do
 * primeiro desenho e empurra o resto" que o portão de CLS reprova. O
 * esqueleto já reserva a altura, então esperar não desloca nada.
 *
 * A gravação é otimista (mesmo desenho do `MetaFaixa`): aplica local,
 * dispara o `PUT`, reverte no erro — dobrar um grupo não pode esperar a
 * rede. A busca vive INLINE dentro do efeito porque o linter do React
 * Compiler recusa chamar, de dentro de um efeito, função de escopo
 * externo que atualize estado (ver "Padrão de fetch em useEffect").
 */
export function usePreferenciasListas() {
  const [preferencias, setPreferencias] = useState<PreferenciasListas | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .preferenciasListas()
      .then(({ preferencias: data }) => {
        if (!ignore) setPreferencias(data);
      })
      .catch(() => {
        // Preferência é acessório: sem ela a lista abre no padrão (tudo
        // aberto, modo completo) em vez de ficar presa no esqueleto.
        if (!ignore) {
          setPreferencias({
            leadsCompacto: false,
            gruposFechados: { leads: [], buscas: [] },
          });
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function salvar(proximas: PreferenciasListas) {
    const anterior = preferencias;
    setPreferencias(proximas);
    try {
      await api.salvarPreferenciasListas(proximas);
    } catch {
      setPreferencias(anterior);
    }
  }

  return {
    preferencias,
    /** Dobra/abre um grupo daquela tela (a chave é sempre da tela dada). */
    alternarGrupoLista(lista: Lista, chave: string) {
      if (!preferencias) return;
      void salvar(alternarGrupo(preferencias, lista, chave));
    },
    /** Liga/desliga o modo compacto da lista de leads. */
    definirLeadsCompacto(leadsCompacto: boolean) {
      if (!preferencias) return;
      void salvar({ ...preferencias, leadsCompacto });
    },
  };
}
