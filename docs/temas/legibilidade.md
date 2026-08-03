# Legibilidade no DOM real — texto × fundo efetivo

Varredura de TODO elemento com texto próprio, nas 7 abas, em cada tema.
Para cada um: sobe a árvore até o primeiro fundo opaco (o que de fato
pinta atrás do texto), registra se havia gradiente na cadeia e mede o
contraste entre a `color` computada e esse fundo.

| tema | nós de texto | pior contraste | onde | gradiente sob texto |
|---|---|---|---|---|
| `escuro` | 418 | **4.73:1** | "Excluir" (config) | nenhum |
| `claro` | 418 | **4.92:1** | "novos desde a sua última visita (03/08/2" (hoje) | nenhum |
| `acido` | 418 | **4.98:1** | "Contactado" (hoje) | nenhum |
| `vapor` | 418 | **5.05:1** | "-5" (leads) | nenhum |
| `prisma` | 418 | **5.02:1** | "Contactado" (hoje) | nenhum |