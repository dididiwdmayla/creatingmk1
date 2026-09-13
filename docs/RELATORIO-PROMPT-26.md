# RELATÓRIO — Prompt 26

## Feito

Quatro skins independentes do nicho `lancheria`: `lancheria-meia-noite`, `lancheria-diner`,
`lancheria-pratico` e `lancheria-cantina`. Cada definição tem um único preset. Todas usam
`@radar/lancheria-rx`, pacote compilado de uma única fonte em `lancheriademodois`.
Nenhum seletor de estilo chega ao dono da lancheria.

O contrato foi relido em `f2c80c9a03018fc9fe36241049ac722f706c6b60`, o mesmo commit
consultado na rodada anterior. `SkinDefinition` e `Theme` **não haviam mudado**. Nesta rodada:

- `ThemePaleta` ganha `quente` e `frio` independentes. São obrigatórios para o adaptador
  das quatro skins; o restante do Radar continua compatível. Os aliases antigos servem
  apenas ao chrome existente. O componente e seus preços/medidores leem os papéis próprios.
- `Theme.lancheria` leva os knobs; `DemoData.lancheria` leva o catálogo comercial e o
  funcionamento. O servidor resolve `SkinDefinition → Theme → Tema`, com os dados efetivos
  do lead ou da demo avulsa. Não há escolha de tema pela URL pública.
- `?tema=` só funciona no ambiente de desenvolvimento do projeto de origem. O pacote
  publicado no Radar nem lê esse parâmetro. Teste com outro tema válido na query não altera
  nenhuma das quatro skins.
- Cadastro e editor aceitam nomes, preços explícitos, composições, essenciais, ingredientes
  disponíveis e respectivos adicionais, bebidas/acompanhamentos e textos. O diff salva
  esse catálogo completo sem perder campos. O catálogo não exige os seis slugs originais.
- Telefone, WhatsApp, cidade, endereço e nome vêm dos slots resolvidos do Radar. Marca é
  derivada do nome. Intervalo de abrir/fechar, fuso e pagamentos vêm do funcionamento da
  definição, com override por cliente. Nenhum desses dados está escrito em componente.
- A identidade vazia continua vazia: nenhum lead herda o contato Meia-Noite. Um horário
  semanal importado permanece visível como texto; a placa só calcula ABERTO/FECHADO quando
  o intervalo diário é configurado. Enquanto isso, mostra CONSULTE.
- Capturas automáticas conhecem as novas seções e começam pelo cardápio. Fotos e fontes
  públicas funcionam sem sessão; o harness interno continua protegido pelo proxy.

### Verificação realizada

| Verificação | Resultado |
|---|---|
| Build de produção da origem e do Radar | passou nos dois |
| Regras da origem | 57/57 |
| Contrato físico contra o Prompt 25 | 11 arquivos fixos + 54 WebP idênticos byte a byte |
| Navegador real, produção do Radar | 59/59 asserções |
| Componentes consultando slug do tema | zero |
| Dados literais de casa em componentes | zero |
| Prático / Cantina | somente Inter / sem monoespaçada; algarismos antiquários no raio-x |
| Cliente alternativo | seis receitas com outros slugs, nomes, preços e composições; R$ 41,00 no cardápio e no raio-x |
| Pedido e isolamento | preço/piso/adicionais e WhatsApp usam a instância do próprio estabelecimento |
| Reordenação | aviso uma vez por sessão, some sozinho, não reaparece após recarga |
| 320 × 740 | nenhum overflow horizontal ou alvo interativo abaixo de 44px |

| Cardápio em 390 × 844 | P25 | Radar | Medidas dos cartões |
|---|---:|---:|---|
| Meia-Noite | 4 | 4 | idênticas |
| Diner | 6 | 6 | idênticas |
| Prático | 4 | 4 | idênticas |
| Cantina | 4 | 4 | idênticas |

A barra começa em y=769. Comparação de posição, largura e altura de **todos** os cartões,
sem diferença: `qa/prompt-26/comparacao-p25.json`. Os cardápios mantêm o desenho do P25;
não é necessário repetir suas imagens no relatório. As capturas novas estão em
`qa/prompt-26`, feitas em `/interno/lancheria/lancheria-{tema}`. Essa rota executa
**o mesmo `resolverDemo` e `PaginaDemo` das rotas públicas**, sem `?tema=`, com fixture
explícita e sessão efêmera local. Não foi criado um cliente fictício no Firestore.

O núcleo fixo inclui prensa, limite de afundamento, sombras, salto, posicionamento de
rótulos, Camada, Medidor, baselines, metadados físicos, limites da casa, motion e aviso.
`RaioX.tsx`, `Trilho.tsx` e `Composicao.tsx` **não são byte idênticos**: trocaram imports
comerciais por contexto. Suas fórmulas, geometria, animações e manipulação da pilha não mudaram.
A evidência de bytes contra a base aprovada está em `qa/prompt-26/contrato-origem.json`.

## Não feito

A suíte completa do Radar registra **1.987 aprovados e 2 reprovados**, em 171 arquivos.
As duas falhas pertencem ao teste anterior de importação do Google Maps. Foram reproduzidas
num worktree limpo de `f2c80c9`, sem as mudanças deste prompt:

```text
AssertionError: expected undefined to match object { enriquecimentos: 1 }
AssertionError: expected 200 to be 429 // Object.is equality
```

O teste usa o dia fixo `2026-08-29` para a cota individual. Não alterei essa função nem esse
teste para fazer a rodada parecer verde. Saídas completas e da base em `qa/prompt-26`.
Os testes da integração e os contratos de identidade/captura passaram.

Origem publicada no [PR 15](https://github.com/dididiwdmayla/lancheriademodois/pull/15),
commit `5b3a96b59d90935faa3144305f4ceee3c462efac`. Publicação da integração preparada em PR; não houve merge/deploy em produção nem gravação de
clientes no Firestore nesta sessão. O PR do Radar é uma proposta aditiva revisável, aguardando
a decisão solicitada sobre a skin anterior.

## Adiado

A **Lancheria Chapa Burger** continua intacta: tipografia de pôster com contorno, lente no
hover do cardápio, comida decorativa flutuante e listas de bebidas/acompanhamentos. Não usa
este raio-x. **Proponho conviver**, pois oferece outro produto visual. Não a apaguei, não a
aposentei e não substituí demos existentes. A escolha definitiva é do usuário, conforme
pedido; o registro aditivo está preparado para revisão, não imposto por merge.

Localização além de **pt-BR/BRL**, geração/tradução genérica de conteúdo por IA e cálculo de
agenda semanal ficam fora desta entrega. `SkinDefinition.localeFixo` declara esse limite,
o servidor o aplica e a validação recusa idiomas incompatíveis. O painel não oferece controles
que não funcionam. A criação de demo continua pelo fluxo normal, com identidade do lead e
catálogo editável. A IA de serviços genéricos não é autorizada a inventar camadas calibradas.

## Risco

**O primeiro limite com seis lanches diferentes é o acervo, não o slug ou o preço.**
Com os ingredientes já calibrados, receitas e preços novos entram como dados. Costela,
novo pão ou outra camada inexistente são recusados: não há fotografia/metadados físicos
correspondentes. Mesmo usando ingredientes existentes, as seis fotografias fechadas de
exemplo podem não representar fielmente a receita real. Elas precisam ser substituídas
por material do cliente antes de prometer fidelidade fotográfica.

**O Diner aguenta nomes maiores sem truncar, mas perde densidade.** A largura real medida
é 112,66px por cartão em 390px e 89,33px em 320px, depois de margens, moldura e vãos. Com
os seis nomes longos da fixture, o maior ocupa 6 linhas em 390px e 9 em 320px. O cartão
cresce de 225,47px para 295,45px; ficam **3 itens completos** na entrada, em vez de 6.
Nenhum nome vira reticência. A grade de três colunas foi preservada, como aprovada no P25.
Para um cliente com esse vocabulário, recomendo a folha Cantina ou a lista Prático; adaptar
o painel para duas colunas baixas seria uma decisão de desenho seguinte.

A remoção do preload global de fontes evita baixar famílias de outras skins. As antigas
continuam com as mesmas fontes declaradas, agora baixadas ao serem usadas; a mudança pode
alterar o momento inicial de sua troca de fonte, sem mudar o desenho final.

## Decisões

### Auditoria completa das exceções de tema

| Encontrado na base | Destino / motivo |
|---|---|
| Diner iniciava em Todos e exibia essa opção | `filtroInicial`; primeira-forma deriva da primeira receita, não de um formato fixo |
| Diner abria composição pela foto e escondia a linha de ingredientes | `abrirComposicao`; os três modos estão implementados, inclusive pelo-rótulo |
| Cantina mudava posição de nome/preço e acrescentava pontilhado | `cardapio: folha` |
| Diner usava Adicionar; outros usavam + | `adicionarIcone` |
| Prático usava Personalizar em Cardapio, Carrinho e BarraPedido | `rotulos.modificar` e `rotulos.modificarCurto` |
| Prático desligava o reencaixe da grade | `movimento.grade` |
| Prático usava 120ms e dispensava captura de View Transition | `movimento.transicaoMs` e `movimento.captura` |
| Casa consultava três slugs para estrutura de hero/cabeçalho | `hero` e `cardapio`; textos comerciais em `dados.textos` |
| Diner tinha mascote no rodapé | `mascote`, já existente |
| Cantina tinha frase exclusiva no rodapé | `dados.textos.rodape`, conteúdo opcional |
| Intro dependia implicitamente de assinatura letreiro | `intro`, independente da assinatura |
| Cantina/Prático escolhiam fallback e numerais no helper CSS | `medida.fallback` e `medida.numerais` |
| Folha de fontes dependia da identidade | `folhaFontes`, declarada pelo tema |
| CSS usava seletores por slug para layouts e ritmos | `data-layout` derivado de `cardapio`; nenhuma decisão por identidade |
| Comparações de `assinatura` e `fundo` | mantidas: já são knobs explícitos, não comparações de slug |
| `selecionarTema` compara slug | mantida exclusivamente como seleção de dados na entrada do servidor/dev |
| `data-tema` e nome de classe `diner-recheio` | mantidos como diagnóstico/nome histórico de CSS; não decidem comportamento |
| Slugs de lanche/ingrediente | mantidos: identificam itens do catálogo, não temas |

As quatro declarações são: Meia-Noite, Prático e Cantina usam
`primeira-forma / nenhuma`; Diner usa `todos / pela-foto`. Um teste muda o slug para
`identidade-futura` e habilita `todos / pelo-rotulo`: os seis detalhes continuam funcionando.

O pacote é versionado e derivado, sem quatro cópias do site e sem import remoto em runtime.
A origem e os hashes acompanham o artefato. Uma correção é feita na origem, exportada uma vez
e consumida pelas quatro skins. CSS isolado inclui portais e pseudo-elementos de transição.
Os 54 assets são únicos no Radar e compartilhados por todas as instâncias.

### Assets por cliente — custo e requisitos, sem implementação

Há dois trabalhos diferentes:

1. **Fotos dos lanches fechados:** receber até seis fotos próprias, tratar recorte/cor,
   exportar WebP e cadastrá-las num manifesto de assets por cliente. O contrato atual limita
   `foto` ao acervo; essa ampliação precisa de validação, armazenamento/CDN e resolução dos
   caminhos por tenant. Só trocar nome e preço não torna a foto atual fiel a uma receita nova.
2. **Camadas novas para o raio-x:** fotografar em canvas **2000 × 1200**, objeto centralizado,
   câmera **0° lateral**, luz quente única acima à esquerda, recorte consistente e sem sombra
   projetada. Cada camada precisa de ficha, metadados e calibração de encaixe/sombra/prensa,
   verificada com seus dois pães e nos estados aberto/fechado. Fotos feitas de cima ou com
   outra luz não são corrigidas por um upload. A calibração é uma versão técnica do acervo/
   motor, **nunca campos livres da skin** nem novos números enviados pelo cliente.

Estimativa de planejamento, não orçamento fechado: com seis fotos fechadas já bem captadas,
**meio a um dia de preparo e QA**, além da implementação inicial do manifesto/upload. Para
cada ingrediente novo, reservar **meio a um dia de recorte, ficha, calibração e teste**, após
receber captação compatível; uma sessão fotográfica e refações são custos separados. A
inclusão do primeiro cliente exige ainda a infraestrutura de assets por tenant. Nenhuma
parte desse pipeline foi implementada nem nenhuma foto nova foi gerada nesta rodada.
