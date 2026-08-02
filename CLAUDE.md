@AGENTS.md

# Clone de material bruto (`skins-raw/`)

Ao converter uma skin nova (ver "Padrão para adicionar uma nova skin" em ARCHITECTURE.md), o clone do site original **vai para fora da árvore deste repositório** (ex.: `~/skins-raw/<nicho>/`). Se precisar clonar dentro da árvore mesmo assim, rode `rm -rf skins-raw/<nicho>/.git` **imediatamente após o clone** — um `.git` aninhado sem essa limpeza vira gitlink (`mode 160000`) se for adicionado ao índice por engano, e gitlinks quebram merge/rebase de quem clonar este repo depois. `skins-raw/` está no `.gitignore` e **nunca é commitada**: o repositório original serve só como referência de leitura durante a conversão, não faz parte do histórico deste projeto.
