# `<meta name="theme-color">` por tema

A cor da barra do navegador é a `--surface` do tema ativo do usuário — a
mesma cor do header, para a barra ficar contínua com ele. Sai pronta no
HTML do SERVIDOR (`generateViewport` lê o cookie-espelho), e o seletor
reescreve o `content` na troca, sem recarregar.

| tema | no HTML do servidor | no DOM | tags | esperado |
|---|---|---|---|---|
| `escuro` | `#121b24` | `#121b24` | 1 | `#121b24` ✓ |
| `claro` | `#ffffff` | `#ffffff` | 1 | `#ffffff` ✓ |
| `acido` | `#111710` | `#111710` | 1 | `#111710` ✓ |
| `vapor` | `#0b151d` | `#0b151d` | 1 | `#0b151d` ✓ |
| `prisma` | `#140f22` | `#140f22` | 1 | `#140f22` ✓ |

Troca pelo seletor, sem recarregar: `#121b24` → `#140f22`.