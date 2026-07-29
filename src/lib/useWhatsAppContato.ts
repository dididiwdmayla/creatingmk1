"use client";

import { useState } from "react";

import { api } from "@/lib/api-client";
import { nomeUsuario, type NomesUsuarios } from "@/lib/contato-selo";
import { formatDateShort } from "@/lib/format";
import type { Lead } from "@/lib/leads/types";

interface PendingWhatsApp {
  lead: Lead;
  href: string;
}

/**
 * Intercepta o clique no botão WhatsApp: se OUTRO usuário já registrou o
 * selo de contato deste lead, pede confirmação antes de abrir; senão abre
 * direto e registra o selo (POST idempotente — primeiro contato prevalece).
 * Usado na ficha do lead e em /hoje (os dois lugares com o link wa.me).
 */
export function useWhatsAppContato(meuId: string | null, onRegistrado: (lead: Lead) => void) {
  const [pendente, setPendente] = useState<PendingWhatsApp | null>(null);

  function registrar(lead: Lead) {
    api
      .registrarContato(lead.placeId)
      .then(({ lead: atualizado }) => onRegistrado(atualizado))
      .catch(() => {
        // selo é cortesia (badge/anti-duplicidade) — falha não bloqueia o contato
      });
  }

  function clicar(event: { preventDefault: () => void }, lead: Lead, href: string) {
    // Sempre previne o <a href> nativo: a decisão de abrir é 100% daqui
    // (senão o próprio link dispara um segundo window.open duplicado).
    event.preventDefault();
    const deOutro = lead.seloContato && lead.seloContato.userId !== meuId;
    if (!deOutro) {
      window.open(href, "_blank", "noopener,noreferrer");
      registrar(lead);
      return;
    }
    setPendente({ lead, href });
  }

  function confirmar() {
    if (!pendente) return;
    window.open(pendente.href, "_blank", "noopener,noreferrer");
    registrar(pendente.lead);
    setPendente(null);
  }

  function cancelar() {
    setPendente(null);
  }

  const mensagemConfirmacao = (nomes: NomesUsuarios): string | undefined => {
    if (!pendente?.lead.seloContato) return undefined;
    const nome = nomeUsuario(nomes, pendente.lead.seloContato.userId);
    const data = formatDateShort(pendente.lead.seloContato.em);
    return `${nome} já contatou em ${data} — contatar mesmo assim?`;
  };

  return { pendente, clicar, confirmar, cancelar, mensagemConfirmacao };
}
