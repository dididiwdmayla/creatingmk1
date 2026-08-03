import { notFound } from "next/navigation";

import { resolverCamadaEfeito } from "@/lib/demos/efeitos/camada";
import { EfeitoCamada } from "@/lib/demos/efeitos/EfeitoCamada";
import { resolverEfeitoFundo } from "@/lib/demos/efeitos/registry";
import { getSkin, getTheme } from "@/lib/demos/registry";
import { aplicarTema } from "@/lib/demos/tema";
import type { EfeitoIntensidade } from "@/lib/demos/efeitos/types";
import { modoValido } from "@/lib/demos/cores/modos";
import type { CoresModoValor, LedPreset, TemaPatch } from "@/lib/demos/types";
import { demoCoreFontsClassName } from "@/app/demo/fonts";

/**
 * Harness interno de AVALIAÇÃO VISUAL da camada decorativa (efeitos de
 * fundo + estilos de LED) sobre uma skin real. Irmã de /interno/efeitos —
 * aquela isola cada efeito em painéis de fundo chapado (bom pra comparar
 * efeitos entre si), esta renderiza a MESMA árvore da rota pública
 * (`<Skin>` + `<EfeitoDinamico>` como sibling; o LED já vem embutido no
 * `Skin.tsx` de cada skin), que é onde os defeitos de acabamento aparecem:
 * aresta dura contra o conteúdo, opacidade alta por cima de texto, faixa
 * do LED cortando a página.
 *
 * Não toca no Firestore: skin, preset, efeito, intensidade e LED vêm
 * SÓ da query string, sobre o `demoDataExemplo` da própria skin — nenhum
 * lead precisa existir, nenhuma demo precisa estar salva. Protegida pela
 * sessão como o resto do app (o proxy cobre /interno por padrão), então
 * pode ficar no repo: é o que torna o laço de verificação visual
 * (`scripts/qa-visual.mjs`) reproduzível sem rota temporária nem exceção
 * no proxy — ver "Verificação da UI" em ARCHITECTURE.md.
 *
 * Query string (tudo opcional):
 *   skin=<id>            default: barbearia-editorial
 *   preset=<themeId>     default: o themeDefault da skin
 *   efeito=<id>|nenhum   default: nenhum
 *   intensidade=0..3     default: o default do nicho
 *   led=desligado|sutil|marcante
 *   ledEstilo=barra|dissipado|cantos|moldura
 *   corModo=<modo>       modo de cor do EFEITO (tema/fixa/transicao/iridescente/arco-iris)
 *   cores=#aabbcc,#...   cores do modo do efeito (1 em "fixa", 2-3 em "transicao")
 *   ledCorModo=<modo>    idem para o LED
 *   ledCores=#aabbcc,#...
 *   semAnim=id1,id2      seções com a animação DESLIGADA (DemoSecao.animacao)
 *   intro=0              desliga a splash de abertura (default nas capturas)
 */

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function texto(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor !== "" ? valor : undefined;
}

function intensidadeDaQuery(valor: string | undefined): EfeitoIntensidade | undefined {
  if (valor === undefined) return undefined;
  const n = Number(valor);
  return n === 0 || n === 1 || n === 2 || n === 3 ? n : undefined;
}

function ledDaQuery(valor: string | undefined): LedPreset | undefined {
  return valor === "desligado" || valor === "sutil" || valor === "marcante" ? valor : undefined;
}

/** modo + lista de cores da query → o mesmo valor que o editor persiste. */
function coresModoDaQuery(
  modo: string | undefined,
  cores: string | undefined,
): CoresModoValor | undefined {
  if (!modoValido(modo)) return undefined;
  return { modo, cores: cores?.split(",").map((c) => c.trim()).filter(Boolean) };
}

export default async function DemoQaPage({ searchParams }: Props) {
  const query = await searchParams;

  const skin = getSkin(texto(query.skin) ?? "barbearia-editorial");
  if (!skin) notFound();

  // Mesma cadeia da rota pública: preset ← TemaPatch (aqui montado da
  // query em vez de vir do Firestore) → aplicarTema → resolverEfeitoFundo.
  const patch: TemaPatch = {
    fundoEfeito: texto(query.efeito),
    fundoEfeitoIntensidade: intensidadeDaQuery(texto(query.intensidade)),
    led: ledDaQuery(texto(query.led)),
    ledEstilo: texto(query.ledEstilo),
    efeitoCores: coresModoDaQuery(texto(query.corModo), texto(query.cores)),
    ledCores: coresModoDaQuery(texto(query.ledCorModo), texto(query.ledCores)),
    intro: texto(query.intro) === "0" ? false : undefined,
  };
  const theme = aplicarTema(
    getTheme(skin, texto(query.preset)),
    patch,
    skin.heroEscalaLimites,
  );

  const efeitoFundo = resolverEfeitoFundo(
    theme.fundoEfeito,
    patch.fundoEfeitoIntensidade,
    skin.nicho,
  );
  const camada = resolverCamadaEfeito({
    paleta: theme.paleta,
    efeitoId: efeitoFundo?.efeito.id,
    efeitoCores: theme.efeitoCores,
    auraCores: undefined,
  });

  // Seções com animação desligada (item "Animação por seção"): mesmo
  // caminho do editor — um patch em `dados.secoes.{id}.animacao`.
  const semAnim = (texto(query.semAnim) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const dados = semAnim.length
    ? {
        ...skin.demoDataExemplo,
        secoes: semAnim.reduce(
          (acc, id) => ({ ...acc, [id]: { ...acc[id], animacao: false } }),
          skin.demoDataExemplo.secoes,
        ),
      }
    : skin.demoDataExemplo;

  const Skin = skin.componente;
  return (
    <div className={demoCoreFontsClassName}>
      <Skin data={dados} theme={theme} />
      {efeitoFundo && (
        // Sibling da skin e resolvido por EfeitoCamada — exatamente como
        // /demo/[leadId] faz (ver o comentário lá sobre nunca chamar
        // getEfeitoComponenteDinamico direto de um Server Component).
        <EfeitoCamada
          id={efeitoFundo.efeito.id}
          intensidade={efeitoFundo.intensidade}
          cores={camada.cores}
          coresCss={camada.coresCss}
          coresAnimacao={camada.coresAnimacao}
        />
      )}
    </div>
  );
}
