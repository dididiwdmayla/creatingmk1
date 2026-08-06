import { ImageResponse } from "next/og";

import type { ThemePaleta } from "@/lib/demos/types";

/**
 * O desenho do recurso de reserva da prévia (ver ./route.ts para o porquê
 * de ele existir).
 *
 * `ImageResponse` renderiza no servidor com Satori + Resvg: **nenhum
 * JavaScript roda no cliente**, que é a condição do buscador de prévia do
 * WhatsApp. A fonte padrão vem embutida no pacote do Next — não há busca
 * de fonte na rede, que é o que faria a primeira resposta demorar. Medido:
 * 162ms na primeira chamada, 26ms na segunda.
 *
 * Só que a face embutida é a REGULAR: o `fontWeight` abaixo não engorda
 * nada, e quem carrega a legibilidade é o corpo do tipo. Fica declarado
 * porque é a intenção, e passa a valer sozinho no dia em que uma face
 * negrito entrar.
 *
 * Fica num `.tsx` separado da rota porque route handler é `.ts`: o JSX
 * precisa de um módulo que o compilador trate como React.
 *
 * O desenho é deliberadamente simples — nome do negócio grande sobre a cor
 * da marca. Ele NÃO tenta imitar a prévia composta: sem o print do topo do
 * site, imitar o layout dela renderizaria uma janela de navegador vazia,
 * que promete um site e mostra um retângulo.
 */
export function imagemDeReserva({
  nome,
  paleta,
  fundo,
  largura,
  altura,
}: {
  nome: string;
  paleta: ThemePaleta;
  fundo: string;
  largura: number;
  altura: number;
}): ImageResponse {
  // Mesmo critério de `tamanhoDoNome` na composição de verdade: o nome tem
  // que continuar legível no tamanho em que o cartão aparece na conversa,
  // e encolher é o último recurso.
  const tamanho = nome.length <= 14 ? 92 : nome.length <= 22 ? 78 : nome.length <= 34 ? 64 : 54;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px 96px",
          background: fundo,
          color: paleta.texto,
        }}
      >
        {/* Uma barra na cor de acento no lugar de qualquer moldura: dá
            marca à imagem sem fingir que existe um print por trás. */}
        <div
          style={{
            width: 132,
            height: 10,
            borderRadius: 10,
            marginBottom: 44,
            background: paleta.destaque,
          }}
        />
        <div style={{ fontSize: tamanho, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>
          {nome}
        </div>
      </div>
    ),
    {
      width: largura,
      height: altura,
      headers: {
        // Curto de propósito: esta imagem é a que vale ATÉ as capturas
        // rodarem. Cache longo faria o cartão continuar simples depois de
        // a prévia de verdade já existir.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
