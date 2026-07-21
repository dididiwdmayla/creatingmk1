import { SKUS, type Sku } from "@/lib/costs";

export const SKU_LABELS: Record<Sku, string> = {
  textSearch: "Busca de leads (Text Search Pro)",
  textSearchEnterprise: "Busca qualificada (Enterprise)",
  detailsEssentials: "Detalhes básicos (Essentials)",
  detailsEnterprise: "Enriquecimento (Enterprise)",
  detailsProHours: "Horário de funcionamento (Pro)",
  geocoding: "Região da busca (Geocoding)",
  aiGeneration: "Sugestões de IA (Gemini)",
};

export { SKUS };
