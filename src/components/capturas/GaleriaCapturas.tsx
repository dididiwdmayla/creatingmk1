"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";

import {
  CAPTURA_TELAS,
  nomeDoArquivo,
  porTela,
  versaoDaImagem,
  type CapturaImagem,
  type CapturaPrevia,
  type CapturaTela,
  type CapturaVersao,
} from "@/lib/demos/capturas/estado";

import {
  baixarUmAUm,
  buscarArquivos,
  classificarFalha,
  podeCompartilharArquivos,
  type ImagemParaAcao,
} from "./acoes";

/**
 * As capturas prontas de um lead, em DUAS SEÇÕES — celular e desktop —
 * com alternância entre a versão crua e a composta em moldura.
 *
 * Agrupar por tela (e não por âncora) é o que casa com o uso: quem manda
 * print no WhatsApp manda a sequência de celular OU a de desktop, nunca
 * uma de cada. A alternância existe porque as duas versões servem a coisas
 * diferentes — a composta é a que se manda inteira, a crua é a que se
 * recorta e manda como detalhe.
 *
 * **Duas ações, distintas e explícitas**, nas três escalas (uma imagem, as
 * três de um grupo, as seis): "Compartilhar" abre a folha nativa com as
 * imagens anexadas e NÃO salva nada no aparelho; "Baixar" salva os
 * arquivos, um por imagem, sem compactar. Onde a folha nativa não anexa
 * arquivo, a ação de compartilhar não aparece — botão que não funciona é
 * pior que botão nenhum.
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
 * As miniaturas são LADRILHOS de altura fixa, com a imagem encaixada — não
 * a captura inteira reduzida.
 *
 * Uma seção de celular tem três telas de altura; emoldurada, passa de
 * 2500px. Reduzida na proporção, viraria uma tira de meio metro na ficha,
 * e a grade ficaria cheia de buracos onde um ladrilho comprido empurra o
 * vizinho. A imagem inteira continua a um clique.
 */
const LADRILHO: Record<CapturaTela, string> = { celular: "w-[116px]", desktop: "w-[200px]" };
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

/**
 * A capacidade do aparelho é lida por `useSyncExternalStore`, e não por
 * estado somado a efeito: no servidor não existe `navigator`, e responder
 * no primeiro render divergiria da hidratação. O snapshot do servidor é
 * `false` (sem botão), o do cliente é a sonda de verdade — e a capacidade
 * não muda durante a sessão, então não há nada a que se inscrever.
 */
const SEM_MUDANCA = () => () => undefined;
const NO_SERVIDOR = () => false;

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
  const compartilhaArquivo = useSyncExternalStore(
    SEM_MUDANCA,
    podeCompartilharArquivos,
    NO_SERVIDOR,
  );

  const grupos = porTela(imagens);
  const total = imagens.length;
  if (total === 0) return null;

  const paraAcao = (lista: CapturaImagem[]): ImagemParaAcao[] =>
    lista.flatMap((imagem) => {
      // Sem a versão pedida, a imagem fica de FORA da ação em vez de a
      // seleção cair calada na outra versão.
      if (!versaoDaImagem(imagem, versao)) return [];
      const busca = new URLSearchParams({ tela: imagem.tela, ancora: imagem.ancora, versao });
      return [
        {
          url: `/api/leads/${encodeURIComponent(leadId)}/capturas/arquivo?${busca}`,
          nome: nomeDoArquivo(imagem, nomeLead, versao),
        },
      ];
    });

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
        <Acoes
          imagens={paraAcao(imagens)}
          rotuloCompartilhar={`Compartilhar as ${total}`}
          rotuloBaixar={`Baixar as ${total}`}
          compartilhaArquivo={compartilhaArquivo}
          destaque
        />
      </div>

      {/* A diferença entre as duas ações é a única coisa que o operador não
          adivinha: uma manda, a outra guarda. Dizer isso onde ele decide
          evita a descoberta pelo caminho ruim — procurar na galeria do
          celular uma imagem que nunca foi salva. */}
      {compartilhaArquivo && (
        <p className="-mt-2 text-[11px] leading-snug text-ink-muted">
          <span className="font-medium text-ink-secondary">Compartilhar</span> abre a folha do
          aparelho com as imagens anexadas e <strong className="font-medium">não salva nada no
          aparelho</strong>. Para ficar com os arquivos, use{" "}
          <span className="font-medium text-ink-secondary">Baixar</span>.
        </p>
      )}

      {CAPTURA_TELAS.map((tela) => (
        <SecaoTela
          key={tela}
          tela={tela}
          imagens={grupos[tela]}
          versao={versao}
          nomeLead={nomeLead}
          acoes={paraAcao(grupos[tela])}
          compartilhaArquivo={compartilhaArquivo}
          paraAcao={paraAcao}
        />
      ))}

      {previa && <PreviaDoLink previa={previa} nomeLead={nomeLead} />}
    </div>
  );
}

/**
 * O par de ações. Guarda os arquivos já buscados: além de poupar a segunda
 * busca, é o que faz o "toque de novo" do Safari funcionar na hora — com os
 * arquivos em mãos, `share` é chamado ainda dentro do gesto.
 */
function Acoes({
  imagens,
  rotuloCompartilhar,
  rotuloBaixar,
  compartilhaArquivo,
  destaque = false,
}: {
  imagens: ImagemParaAcao[];
  rotuloCompartilhar: string;
  rotuloBaixar: string;
  compartilhaArquivo: boolean;
  destaque?: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [prontos, setProntos] = useState<File[] | null>(null);

  if (imagens.length === 0) return null;

  async function compartilhar() {
    setAviso(null);
    try {
      let arquivos = prontos;
      if (!arquivos) {
        setOcupado(true);
        arquivos = await buscarArquivos(imagens);
        setProntos(arquivos);
      }
      await navigator.share({ files: arquivos });
    } catch (erro) {
      const falha = classificarFalha(erro);
      if (falha === "gesto-expirado") setAviso("Toque de novo para abrir o compartilhamento.");
      else if (falha === "falhou") setAviso("Não deu para compartilhar.");
      // "cancelado" é o operador fechando a folha — não é erro, não vira aviso.
    } finally {
      setOcupado(false);
    }
  }

  async function baixar() {
    setAviso(null);
    await baixarUmAUm(imagens);
  }

  const classe = destaque
    ? "rounded border border-line px-2.5 py-1 text-xs font-medium text-accent hover:border-accent/40 disabled:opacity-50"
    : "text-xs font-medium text-accent hover:underline disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {compartilhaArquivo && (
        <button type="button" onClick={compartilhar} disabled={ocupado} className={classe}>
          {ocupado ? "Preparando…" : rotuloCompartilhar}
        </button>
      )}
      <button type="button" onClick={baixar} className={classe}>
        {rotuloBaixar} ↓
      </button>
      {aviso && <span className="text-[11px] text-warning">{aviso}</span>}
    </div>
  );
}

function SecaoTela({
  tela,
  imagens,
  versao,
  nomeLead,
  acoes,
  compartilhaArquivo,
  paraAcao,
}: {
  tela: CapturaTela;
  imagens: CapturaImagem[];
  versao: CapturaVersao;
  nomeLead: string;
  acoes: ImagemParaAcao[];
  compartilhaArquivo: boolean;
  paraAcao: (lista: CapturaImagem[]) => ImagemParaAcao[];
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
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
          {ROTULO_TELA[tela]}{" "}
          <span className="font-normal text-ink-muted">· {imagens.length}</span>
        </h3>
        <Acoes
          imagens={acoes}
          rotuloCompartilhar={`Compartilhar as ${acoes.length}`}
          rotuloBaixar={`Baixar as ${acoes.length}`}
          compartilhaArquivo={compartilhaArquivo}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {imagens.map((imagem) => (
          <Figura
            key={`${imagem.ancora}-${imagem.tela}`}
            imagem={imagem}
            versao={versao}
            nomeLead={nomeLead}
            acoes={paraAcao([imagem])}
            compartilhaArquivo={compartilhaArquivo}
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
  acoes,
  compartilhaArquivo,
}: {
  imagem: CapturaImagem;
  versao: CapturaVersao;
  nomeLead: string;
  acoes: ImagemParaAcao[];
  compartilhaArquivo: boolean;
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
      <figcaption className="mt-1 text-[11px]">
        <span className="block truncate text-ink-muted" title={imagem.ancora}>
          {String(imagem.ordem).padStart(2, "0")} {imagem.ancora}
        </span>
        {/* Empilhadas: no ladrilho de celular as duas não cabem lado a lado,
            e abreviar "Compartilhar" apagaria justo a palavra que diz o que
            a ação faz. */}
        <span className="mt-0.5 flex flex-col items-start">
          <Acoes
            imagens={acoes}
            rotuloCompartilhar="Compartilhar"
            rotuloBaixar="Baixar"
            compartilhaArquivo={compartilhaArquivo}
          />
        </span>
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
