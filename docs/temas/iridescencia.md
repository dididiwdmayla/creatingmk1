# Proporção de matiz no CROMO (header + barra inferior), rasterizado

Captura dos dois elementos de cromo, decodificada pixel a pixel
(`scripts/png.mjs`). Pixel de croma baixo (max-min < 40) é superfície
sólida, não matiz, e fica fora da conta. Faixas: lima 55–110°,
rosa ≥280° ou <20°, miolo o resto.

| tema | lima | miolo | rosa | cromo colorido |
|---|---|---|---|---|
| `escuro` | 0.1% | 90.8% | **9.0%** | 3.2% dos pixels |
| `claro` | 0.0% | 90.5% | **9.5%** | 3.1% dos pixels |
| `acido` | 37.6% | 54.2% | **8.2%** | 3.1% dos pixels |
| `vapor` | 13.3% | 79.6% | **7.0%** | 3.3% dos pixels |
| `prisma` | 27.0% | 56.6% | **16.4%** | 2.8% dos pixels |