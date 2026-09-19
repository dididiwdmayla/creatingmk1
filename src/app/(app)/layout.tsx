import { cookies } from "next/headers";

import type { MetaProprioResponse } from "@/lib/api-client";
import { getDb } from "@/lib/firebase/admin";
import { getProgressoMetaUsuario, usuarioDaRequest } from "@/lib/usuarios";
import { BalaoFila } from "@/components/BalaoFila";
import { MetaFaixa } from "@/components/MetaFaixa";
import { Nav } from "@/components/Nav";
import { PageTransition } from "@/components/PageTransition";

/**
 * Progresso da meta resolvido no SERVIDOR, antes do primeiro desenho — a
 * mesma ideia do tema (`data-theme` já vem certo no HTML). Sem isso,
 * `MetaFaixa` nasce sem faixa nenhuma (0px) e a busca client-side, ao
 * responder, insere um bloco de ~44-52px ACIMA do cabeçalho e do
 * conteúdo — empurra as duas coisas pra baixo em TODA navegação, em TODA
 * aba, pra quem tem meta configurada (medido: CLS ~0.05 em cada uma das 7
 * abas, sempre a mesma dupla `header`+`main` como fonte). `MetaFaixa`
 * ainda faz o próprio refetch ao trocar de rota (o progresso muda
 * navegando) — isto só resolve o PRIMEIRO desenho.
 */
/**
 * `admin` sai da MESMA leitura de usuário que a meta já fazia — o balão da
 * fila é ADMIN ONLY, e resolver isso no servidor significa que, para membro,
 * ele não chega a entrar no HTML (não é um `display: none` que uma aba de
 * DevTools desfaz, nem uma chamada que volta 403 em toda tela). As rotas
 * dele cobram o papel de novo, como sempre: a tela nunca é a permissão.
 */
async function estadoInicial(): Promise<{
  meta: MetaProprioResponse | null;
  admin: boolean;
}> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const req = new Request("http://localhost/", { headers: { cookie: cookieHeader } });
  const db = getDb();
  const usuario = await usuarioDaRequest(db, req);
  if (!usuario) return { meta: null, admin: false };
  const progresso = await getProgressoMetaUsuario(db, usuario.id, usuario.metas);
  return {
    meta: { ...progresso, minimizada: usuario.metaFaixaMinimizada ?? false },
    admin: usuario.papel === "admin",
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { meta, admin } = await estadoInicial();
  return (
    <div className="flex flex-1 flex-col">
      <MetaFaixa inicial={meta} />
      <Nav />
      {/*
        A GOTEIRA DA DIREITA, e por que ela existe.

        O balão é `fixed`. No desktop isso é de graça: a coluna tem 512px
        centrados e sobram ~290px de margem vazia de cada lado, então ele não
        encosta em nada. No CELULAR a coluna ocupa a largura inteira — medido:
        conteúdo e controles chegam a 374px numa tela de 390 —, e ali um
        elemento fixo no canto inferior direito cobre botão de verdade (a
        varredura de colisão do `--so=balao` pegou o "★" do card de lead e o
        "▾" do cabeçalho da busca).

        Cobrir botão não é aceitável, e a única forma de PROMETER que isso
        não acontece é reservar o espaço de verdade: conteúdo que rola passa
        por baixo de qualquer posição, em algum ponto da rolagem. Então a
        goteira é real, e só onde precisa ser — abaixo do `sm` e só para quem
        tem o balão. O preço está anotado e é consciente: o admin perde 28px
        de largura no celular — e esse número é o tamanho da pílula, não uma
        escolha de gosto: a primeira versão dela custava 40px e o passo
        `--so=vestigio` reprovou, porque o resumo de outro painel da /config
        passou a truncar.

        `pl-4`/`pr-4` explícitos em vez de `px-4` ao lado de `pr-11`: duas
        utilities do mesmo lado dependeriam da ordem no CSS gerado, não da
        ordem em que foram escritas (a variante `sm:` é que vence por vir
        depois, e essa é a regra da Tailwind, não um acaso).
      */}
      <main
        className={`mx-auto w-full max-w-lg flex-1 pb-20 pl-4 pt-4 ${
          admin ? "pr-11 sm:pr-4" : "pr-4"
        }`}
      >
        <PageTransition>{children}</PageTransition>
      </main>
      {/* Fora do <main>: o balão é `fixed` e vale para a tela inteira, não
          para o conteúdo da aba. Fica no LAYOUT (e não em cada página) para
          não remontar a cada navegação — é isso que faz o estado fechado
          custar 2 leituras por carregamento em vez de 2 por aba aberta. */}
      {admin && <BalaoFila />}
    </div>
  );
}
