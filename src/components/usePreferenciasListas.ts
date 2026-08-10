"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import {
  alternarGrupo,
  definirDensidade,
  densidadePadrao,
  PREFERENCIAS_LISTAS_PADRAO,
  type Densidade,
  type Lista,
  type PreferenciasListas,
} from "@/lib/usuarios/preferencias";

/**
 * Preferências de compactação das listas longas (`/leads` e `/buscas`),
 * lidas do doc do usuário e gravadas de volta a cada alternância.
 *
 * `pronto` fica falso enquanto a preferência OU a largura da tela não
 * resolveram — e as duas telas seguram a lista atrás do esqueleto até lá,
 * de propósito: uma grade que nasce com 1 coluna e vira 4 meio segundo
 * depois é exatamente o "elemento que entra depois do primeiro desenho e
 * empurra o resto" que o portão de CLS reprova. O esqueleto já reserva a
 * altura, então esperar não desloca nada.
 *
 * A largura é medida em efeito (não no inicializador do estado) porque o
 * componente também renderiza no servidor: ler `window` na primeira
 * passada daria divergência de hidratação. O efeito roda antes de a busca
 * da preferência voltar da rede, então nada atrasa por causa disso.
 *
 * A gravação é otimista (mesmo desenho do `MetaFaixa`): aplica local,
 * dispara o `PUT`, reverte no erro — dobrar um grupo não pode esperar a
 * rede. A busca vive INLINE dentro do efeito porque o linter do React
 * Compiler recusa chamar, de dentro de um efeito, função de escopo
 * externo que atualize estado (ver "Padrão de fetch em useEffect").
 */
export function usePreferenciasListas() {
  const [preferencias, setPreferencias] = useState<PreferenciasListas | null>(null);
  const [largura, setLargura] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .preferenciasListas()
      .then(({ preferencias: data }) => {
        if (!ignore) setPreferencias(data);
      })
      .catch(() => {
        // Preferência é acessório: sem ela a lista abre no padrão (tudo
        // aberto, densidade da largura da tela) em vez de ficar presa no
        // esqueleto.
        if (!ignore) setPreferencias(PREFERENCIAS_LISTAS_PADRAO);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Girar o aparelho troca a largura, e quem está no automático acompanha
  // — é a mesma resposta que qualquer layout responsivo dá, e acontece
  // fora da janela de carga que o CLS mede.
  useEffect(() => {
    const medir = () => setLargura(window.innerWidth);
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
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
    /** A lista só pode pintar depois disto (ver o porquê acima). */
    pronto: preferencias !== null && largura !== null,
    /**
     * Densidade EFETIVA daquela tela: a escolha do usuário quando existe,
     * senão o padrão da largura atual.
     */
    densidadeDe(lista: Lista): Densidade {
      const escolhida = preferencias?.densidade[lista];
      if (escolhida) return escolhida;
      return largura === null ? 1 : densidadePadrao(largura);
    },
    /** `null` devolve a tela ao padrão automático da largura. */
    definirDensidadeLista(lista: Lista, densidade: Densidade | null) {
      if (!preferencias) return;
      void salvar(definirDensidade(preferencias, lista, densidade));
    },
    /** Dobra/abre um grupo daquela tela (a chave é sempre da tela dada). */
    alternarGrupoLista(lista: Lista, chave: string) {
      if (!preferencias) return;
      void salvar(alternarGrupo(preferencias, lista, chave));
    },
  };
}
