# Contraste por tema — lido do CSS COMPUTADO no browser

Texto de leitura vive em superfície SÓLIDA (`--surface` / `--background`);
nenhum par abaixo é medido contra gradiente. Ver ARCHITECTURE.md.

| tema | par | papel | contraste | mínimo | veredito |
|---|---|---|---|---|---|
| `escuro` | `--foreground` sobre `--surface` | texto de leitura em card | **15.50:1** | 7 | passa |
| `escuro` | `--foreground` sobre `--background` | texto de leitura na página | **17.69:1** | 7 | passa |
| `escuro` | `--ink-secondary` sobre `--surface` | texto secundário em card | **9.74:1** | 4.5 | passa |
| `escuro` | `--ink-muted` sobre `--surface` | rótulo/legenda em card | **5.59:1** | 4.5 | passa |
| `escuro` | `--ink-muted` sobre `--background` | rótulo/legenda na página | **6.38:1** | 4.5 | passa |
| `escuro` | `--ink-muted` sobre `--surface-2` | rótulo/legenda em superfície elevada | **5.00:1** | 4.5 | passa |
| `escuro` | `--ink-secondary` sobre `--surface-2` | texto secundário em superfície elevada | **8.71:1** | 4.5 | passa |
| `escuro` | `--foreground` sobre `--surface-2` | texto de leitura em superfície elevada | **13.86:1** | 7 | passa |
| `escuro` | `--accent` sobre `--surface` | aba ativa / link | **10.75:1** | 4.5 | passa |
| `escuro` | `--accent-ink` sobre `--accent` | texto sobre o botão primário | **11.44:1** | 4.5 | passa |
| `escuro` | `--warning` sobre `--surface` | "Perto do teto" | **9.48:1** | 4.5 | passa |
| `escuro` | `--critical` sobre `--surface` | "No limite" / erro | **4.73:1** | 4.5 | passa |
| `escuro` | `--good` sobre `--surface` | meta atingida | **7.17:1** | 4.5 | passa |
| `escuro` | `--good-ink` sobre `--good` | texto sobre fill good | **7.64:1** | 4.5 | passa |
| `escuro` | `--critical-ink` sobre `--critical` | texto sobre fill critical | **5.37:1** | 4.5 | passa |
| `escuro` | `--apoio` sobre `--surface` | verde-lima de apoio como texto | **10.75:1** | 4.5 | passa |
| `escuro` | `--faisca` sobre `--surface` | rosa de destaque como texto | **6.02:1** | 4.5 | passa |
| `escuro` | `--faisca-ink` sobre `--faisca` | texto sobre o rosa | **6.86:1** | 4.5 | passa |
| `claro` | `--foreground` sobre `--surface` | texto de leitura em card | **16.76:1** | 7 | passa |
| `claro` | `--foreground` sobre `--background` | texto de leitura na página | **14.85:1** | 7 | passa |
| `claro` | `--ink-secondary` sobre `--surface` | texto secundário em card | **8.84:1** | 4.5 | passa |
| `claro` | `--ink-muted` sobre `--surface` | rótulo/legenda em card | **5.55:1** | 4.5 | passa |
| `claro` | `--ink-muted` sobre `--background` | rótulo/legenda na página | **4.92:1** | 4.5 | passa |
| `claro` | `--ink-muted` sobre `--surface-2` | rótulo/legenda em superfície elevada | **5.05:1** | 4.5 | passa |
| `claro` | `--ink-secondary` sobre `--surface-2` | texto secundário em superfície elevada | **8.04:1** | 4.5 | passa |
| `claro` | `--foreground` sobre `--surface-2` | texto de leitura em superfície elevada | **15.24:1** | 7 | passa |
| `claro` | `--accent` sobre `--surface` | aba ativa / link | **5.34:1** | 4.5 | passa |
| `claro` | `--accent-ink` sobre `--accent` | texto sobre o botão primário | **5.34:1** | 4.5 | passa |
| `claro` | `--warning` sobre `--surface` | "Perto do teto" | **5.65:1** | 4.5 | passa |
| `claro` | `--critical` sobre `--surface` | "No limite" / erro | **5.43:1** | 4.5 | passa |
| `claro` | `--good` sobre `--surface` | meta atingida | **5.38:1** | 4.5 | passa |
| `claro` | `--good-ink` sobre `--good` | texto sobre fill good | **5.38:1** | 4.5 | passa |
| `claro` | `--critical-ink` sobre `--critical` | texto sobre fill critical | **5.43:1** | 4.5 | passa |
| `claro` | `--apoio` sobre `--surface` | verde-lima de apoio como texto | **5.34:1** | 4.5 | passa |
| `claro` | `--faisca` sobre `--surface` | rosa de destaque como texto | **6.12:1** | 4.5 | passa |
| `claro` | `--faisca-ink` sobre `--faisca` | texto sobre o rosa | **6.12:1** | 4.5 | passa |
| `acido` | `--foreground` sobre `--surface` | texto de leitura em card | **16.08:1** | 7 | passa |
| `acido` | `--foreground` sobre `--background` | texto de leitura na página | **17.87:1** | 7 | passa |
| `acido` | `--ink-secondary` sobre `--surface` | texto secundário em card | **10.31:1** | 4.5 | passa |
| `acido` | `--ink-muted` sobre `--surface` | rótulo/legenda em card | **6.10:1** | 4.5 | passa |
| `acido` | `--ink-muted` sobre `--background` | rótulo/legenda na página | **6.78:1** | 4.5 | passa |
| `acido` | `--ink-muted` sobre `--surface-2` | rótulo/legenda em superfície elevada | **5.36:1** | 4.5 | passa |
| `acido` | `--ink-secondary` sobre `--surface-2` | texto secundário em superfície elevada | **9.06:1** | 4.5 | passa |
| `acido` | `--foreground` sobre `--surface-2` | texto de leitura em superfície elevada | **14.13:1** | 7 | passa |
| `acido` | `--accent` sobre `--surface` | aba ativa / link | **15.06:1** | 4.5 | passa |
| `acido` | `--accent-ink` sobre `--accent` | texto sobre o botão primário | **15.60:1** | 4.5 | passa |
| `acido` | `--warning` sobre `--surface` | "Perto do teto" | **11.28:1** | 4.5 | passa |
| `acido` | `--critical` sobre `--surface` | "No limite" / erro | **6.53:1** | 4.5 | passa |
| `acido` | `--good` sobre `--surface` | meta atingida | **10.20:1** | 4.5 | passa |
| `acido` | `--good-ink` sobre `--good` | texto sobre fill good | **10.37:1** | 4.5 | passa |
| `acido` | `--critical-ink` sobre `--critical` | texto sobre fill critical | **7.03:1** | 4.5 | passa |
| `acido` | `--apoio` sobre `--surface` | verde-lima de apoio como texto | **15.06:1** | 4.5 | passa |
| `acido` | `--faisca` sobre `--surface` | rosa de destaque como texto | **5.89:1** | 4.5 | passa |
| `acido` | `--faisca-ink` sobre `--faisca` | texto sobre o rosa | **6.41:1** | 4.5 | passa |
| `vapor` | `--foreground` sobre `--surface` | texto de leitura em card | **16.10:1** | 7 | passa |
| `vapor` | `--foreground` sobre `--background` | texto de leitura na página | **17.64:1** | 7 | passa |
| `vapor` | `--ink-secondary` sobre `--surface` | texto secundário em card | **10.18:1** | 4.5 | passa |
| `vapor` | `--ink-muted` sobre `--surface` | rótulo/legenda em card | **5.77:1** | 4.5 | passa |
| `vapor` | `--ink-muted` sobre `--background` | rótulo/legenda na página | **6.33:1** | 4.5 | passa |
| `vapor` | `--ink-muted` sobre `--surface-2` | rótulo/legenda em superfície elevada | **5.05:1** | 4.5 | passa |
| `vapor` | `--ink-secondary` sobre `--surface-2` | texto secundário em superfície elevada | **8.91:1** | 4.5 | passa |
| `vapor` | `--foreground` sobre `--surface-2` | texto de leitura em superfície elevada | **14.10:1** | 7 | passa |
| `vapor` | `--accent` sobre `--surface` | aba ativa / link | **12.19:1** | 4.5 | passa |
| `vapor` | `--accent-ink` sobre `--accent` | texto sobre o botão primário | **12.55:1** | 4.5 | passa |
| `vapor` | `--warning` sobre `--surface` | "Perto do teto" | **11.12:1** | 4.5 | passa |
| `vapor` | `--critical` sobre `--surface` | "No limite" / erro | **6.61:1** | 4.5 | passa |
| `vapor` | `--good` sobre `--surface` | meta atingida | **10.33:1** | 4.5 | passa |
| `vapor` | `--good-ink` sobre `--good` | texto sobre fill good | **10.37:1** | 4.5 | passa |
| `vapor` | `--critical-ink` sobre `--critical` | texto sobre fill critical | **7.03:1** | 4.5 | passa |
| `vapor` | `--apoio` sobre `--surface` | verde-lima de apoio como texto | **13.34:1** | 4.5 | passa |
| `vapor` | `--faisca` sobre `--surface` | rosa de destaque como texto | **6.39:1** | 4.5 | passa |
| `vapor` | `--faisca-ink` sobre `--faisca` | texto sobre o rosa | **6.84:1** | 4.5 | passa |
| `prisma` | `--foreground` sobre `--surface` | texto de leitura em card | **15.92:1** | 7 | passa |
| `prisma` | `--foreground` sobre `--background` | texto de leitura na página | **17.33:1** | 7 | passa |
| `prisma` | `--ink-secondary` sobre `--surface` | texto secundário em card | **9.73:1** | 4.5 | passa |
| `prisma` | `--ink-muted` sobre `--surface` | rótulo/legenda em card | **5.73:1** | 4.5 | passa |
| `prisma` | `--ink-muted` sobre `--background` | rótulo/legenda na página | **6.23:1** | 4.5 | passa |
| `prisma` | `--ink-muted` sobre `--surface-2` | rótulo/legenda em superfície elevada | **5.25:1** | 4.5 | passa |
| `prisma` | `--ink-secondary` sobre `--surface-2` | texto secundário em superfície elevada | **8.91:1** | 4.5 | passa |
| `prisma` | `--foreground` sobre `--surface-2` | texto de leitura em superfície elevada | **14.59:1** | 7 | passa |
| `prisma` | `--accent` sobre `--surface` | aba ativa / link | **7.03:1** | 4.5 | passa |
| `prisma` | `--accent-ink` sobre `--accent` | texto sobre o botão primário | **7.41:1** | 4.5 | passa |
| `prisma` | `--warning` sobre `--surface` | "Perto do teto" | **11.30:1** | 4.5 | passa |
| `prisma` | `--critical` sobre `--surface` | "No limite" / erro | **6.72:1** | 4.5 | passa |
| `prisma` | `--good` sobre `--surface` | meta atingida | **10.50:1** | 4.5 | passa |
| `prisma` | `--good-ink` sobre `--good` | texto sobre fill good | **10.37:1** | 4.5 | passa |
| `prisma` | `--critical-ink` sobre `--critical` | texto sobre fill critical | **7.03:1** | 4.5 | passa |
| `prisma` | `--apoio` sobre `--surface` | verde-lima de apoio como texto | **14.04:1** | 4.5 | passa |
| `prisma` | `--faisca` sobre `--surface` | rosa de destaque como texto | **6.79:1** | 4.5 | passa |
| `prisma` | `--faisca-ink` sobre `--faisca` | texto sobre o rosa | **7.13:1** | 4.5 | passa |