# Proporção de matiz no CROMO (header + barra inferior), rasterizado

Captura dos dois elementos de cromo, decodificada pixel a pixel
(`scripts/png.mjs`). Pixel de croma baixo (max-min < 40) é superfície
sólida, não matiz, e fica fora da conta. Faixas: lima 55–110°,
rosa ≥280° ou <20°, miolo o resto.

| tema | lima | miolo | rosa | cromo colorido |
|---|---|---|---|---|
| `escuro` | 0.2% | 90.8% | **9.0%** | 2.3% dos pixels |
| `claro` | 0.0% | 90.7% | **9.3%** | 2.2% dos pixels |
| `acido` | 37.1% | 55.0% | **7.9%** | 2.2% dos pixels |
| `vapor` | 9.3% | 85.6% | **5.1%** | 3.2% dos pixels |
| `prisma` | 25.8% | 57.7% | **16.5%** | 2.0% dos pixels |