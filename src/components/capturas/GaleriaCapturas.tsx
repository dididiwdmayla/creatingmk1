"use client";

import Image from "next/image";
import { useState } from "react";

import {
  CAPTURA_TELAS,
  porTela,
  versaoDaImagem,
  type CapturaImagem,
  type CapturaPrevia,
  type CapturaTela,
  type CapturaVersao,
} from "@/lib/demos/capturas/estado";

/**
 * As capturas prontas de um lead, em DUAS SEÇÕES — celular e desktop —
 * com alternância entre a versão crua e a composta em moldura.
 *
 * Agrupar por tela (e não por âncora, como antes) é o que casa com o uso:
 * quem manda print no WhatsApp manda a sequência de celular OU a de
 * desktop, nunca uma de cada. A alternância existe porque as duas versões
 * servem a coisas diferentes — a composta é a que se manda inteira, a crua
 * é a que se recorta e manda como detalhe.
 *
 * Downloads em três tamanhos: uma imagem, as três de um grupo, ou as seis.
 * As duas últimas passam por `/api/leads/{id}/capturas/zip`, que empacota
 * no servidor: zipar no cliente exigiria buscar os objetos por `fetch`, e
 * o bucket não tem cabeçalho de CORS (é o mesmo motivo pelo qual o objeto
 * sobe com `Content-Disposition: attachment`, para o link de UMA imagem
 * salvar em vez de abrir uma aba).
 *
 * A miniatura é `unoptimized`: as imagens já saem do motor no tamanho e na
 * qualidade que vão para o WhatsApp, e passá-las pelo otimizador do Next
 * só gastaria transformação para reencodar o que já está pronto.
 */

const ROTULO_TELA: Record<CapturaTela, string> = { celular: "Celular", desktop: "Desktop" };

const VERSOES: Array<{ id: CapturaVersao; rotulo: string }> = [
  { id: "moldura", rotulo: "Com moldura" },
  { id: "crua", rotulo: "Crua" },
];

/**
 * As miniaturas são LADRILHOS de altura fixa, com a imagem cortada a
 * partir do topo — não a captura inteira reduzida.
 *
 * Uma seção de celular tem três telas de altura; emoldurada, passa de
 * 2500px. Reduzida na proporção, viraria uma tira de meio metro na ficha,
 * e a grade ficaria cheia de buracos onde um ladrilho comprido empurra o
 * vizinho. Cortando a partir do topo, todas as capturas de um grupo se
 * alinham e a seção volta a ser uma folha de contatos — que é como se olha
 * seis imagens de uma vez. A imagem inteira continua a um clique.
 */
const LADRILHO: Record<CapturaTela, string> = { celular: "w-[104px]", desktop: "w-[196px]" };
const ALTURA_LADRILHO = "h-[168px]";
/**
 * O encaixe difere por tela porque a forma difere. A captura de celular é
 * comprida: cortada a partir do topo, mostra o começo da seção, que é o
 * que identifica a imagem. A de desktop é larga: cortar as laterais comeria
 * a borda da janela, e a janela é justamente o que faz a imagem se ler
 * como um site — então ela cabe inteira, com tarja escura em volta.
 */
const ENCAIXE: Record<CapturaTela, string> = {
  celular: "object-cover object-top",
  desktop: "object-contain",
};

export function GaleriaCapturas({
  imagens,
  nomeLead,
  leadId,
  previa,
}: {
  imagens: CapturaImagem[];
  nomeLead: string;
  leadId: string;
  previa?: CapturaPrevia;
}) {
  // Começa na composta: é a versão que se manda numa conversa. A crua
  // continua a um clique, para quem vai recortar.
  const [versao, setVersao] = useState<CapturaVersao>("moldura");
  const grupos = porTela(imagens);
  const total = imagens.length;
  if (total === 0) return null;

  const pacote = (tela: CapturaTela | "tudo") =>
    `/api/leads/${encodeURIComponent(leadId)}/capturas/zip?tela=${tela}&versao=${versao}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded border border-line p-0.5" role="group">
          {VERSOES.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              onClick={() => setVersao(opcao.id)}
              aria-pressed={versao === opcao.id}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                versao === opcao.id
                  ? "bg-accent text-accent-ink"
                  : "text-ink-secondary hover:text-foreground"
              }`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        <a
          href={pacote("tudo")}
          className="rounded border border-line px-2.5 py-1 text-xs font-medium text-accent hover:border-accent/40"
        >
          Baixar as {total} ↓
        </a>
      </div>

      {CAPTURA_TELAS.map((tela) => (
        <SecaoTela
          key={tela}
          tela={tela}
          imagens={grupos[tela]}
          versao={versao}
          nomeLead={nomeLead}
          urlPacote={pacote(tela)}
        />
      ))}

      {previa && <PreviaDoLink previa={previa} nomeLead={nomeLead} />}
    </div>
  );
}

function SecaoTela({
  tela,
  imagens,
  versao,
  nomeLead,
  urlPacote,
}: {
  tela: CapturaTela;
  imagens: CapturaImagem[];
  versao: CapturaVersao;
  nomeLead: string;
  urlPacote: string;
}) {
  if (imagens.length === 0) {
    // Grupo inteiro ausente é diferente de uma captura que faltou: dizer
    // qual das duas telas não saiu poupa o operador de procurar.
    return (
      <p className="rounded border border-dashed border-line px-3 py-3 text-xs text-ink-muted">
        Nenhuma captura de {ROTULO_TELA[tela].toLowerCase()} nesta rodada.
      </p>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          {ROTULO_TELA[tela]}{" "}
          <span className="font-normal text-ink-muted">· {imagens.length}</span>
        </h3>
        <a href={urlPacote} className="text-xs font-medium text-accent hover:underline">
          Baixar as {imagens.length} ↓
        </a>
      </div>
      <div className="flex flex-wrap gap-3">
        {imagens.map((imagem) => (
          <Figura
            key={`${imagem.ancora}-${imagem.tela}`}
            imagem={imagem}
            versao={versao}
            nomeLead={nomeLead}
          />
        ))}
      </div>
    </section>
  );
}

function Figura({
  imagem,
  versao,
  nomeLead,
}: {
  imagem: CapturaImagem;
  versao: CapturaVersao;
  nomeLead: string;
}) {
  const alvo = versaoDaImagem(imagem, versao);

  // Captura sem a versão pedida vira vão EXPLÍCITO, nunca a outra versão
  // no lugar sem avisar: entregar a crua onde se pediu moldura é uma
  // mentira pequena que só aparece depois de a imagem já ter sido enviada.
  if (!alvo) {
    return (
      <p
        className={`${LADRILHO[imagem.tela]} ${ALTURA_LADRILHO} m-0 flex items-center rounded border border-dashed border-line px-2 text-center text-[11px] leading-tight text-ink-muted`}
      >
        {imagem.ancora} saiu sem moldura nesta rodada
      </p>
    );
  }

  return (
    <figure className={`m-0 ${LADRILHO[imagem.tela]}`}>
      <a
        href={alvo.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${ALTURA_LADRILHO} overflow-hidden rounded border border-line bg-surface-2 hover:border-accent/40`}
      >
        <Image
          src={alvo.url}
          alt={`${nomeLead} — ${imagem.ancora} (${ROTULO_TELA[imagem.tela]})`}
          width={alvo.largura}
          height={alvo.altura}
          unoptimized
          className={`h-full w-full ${ENCAIXE[imagem.tela]}`}
        />
      </a>
      <figcaption className="mt-1 flex items-baseline justify-between gap-1.5 text-[11px]">
        <span className="truncate text-ink-muted" title={imagem.ancora}>
          {String(imagem.ordem).padStart(2, "0")} {imagem.ancora}
        </span>
        <a href={alvo.url} download className="shrink-0 font-medium text-accent hover:underline">
          Baixar
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * A prévia do link, no tamanho aproximado em que ela aparece num cartão de
 * conversa. Não é decoração: é a única forma de o operador conferir, antes
 * de mandar, que o nome do negócio continua legível quando a imagem
 * encolhe — que é a coisa que a composição existe para garantir.
 */
function PreviaDoLink({ previa, nomeLead }: { previa: CapturaPrevia; nomeLead: string }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">
        Prévia do link{" "}
        <span className="font-normal text-ink-muted">· como aparece na conversa</span>
      </h3>
      <a
        href={previa.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-[300px] max-w-full overflow-hidden rounded border border-line bg-surface-2 hover:border-accent/40"
      >
        <Image
          src={previa.url}
          alt={`${nomeLead} — prévia do link`}
          width={previa.largura}
          height={previa.altura}
          unoptimized
          className="h-auto w-full"
        />
      </a>
    </section>
  );
}
