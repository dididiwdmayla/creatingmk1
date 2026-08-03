# Proporção de matiz no CROMO (header + barra inferior), rasterizado

Captura dos dois elementos de cromo, decodificada pixel a pixel
(`scripts/png.mjs`). Pixel de croma baixo (max-min < 40) é superfície
sólida, não matiz, e fica fora da conta. Faixas: lima 55–110°,
rosa ≥280° ou <20°, miolo o resto.

| tema | lima | miolo | rosa | cromo colorido |
|---|---|---|---|---|
| `escuro` | 0.2% | 90.6% | **9.3%** | 3.2% dos pixels |
| `claro` | 0.0% | 90.4% | **9.6%** | 3.1% dos pixels |
| `acido` | 36.4% | 55.1% | **8.5%** | 3.0% dos pixels |
| `vapor` | 13.8% | 79.0% | **7.3%** | 3.2% dos pixels |
| `prisma` | 27.8% | 55.5% | **16.7%** | 2.7% dos pixels |