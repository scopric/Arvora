import type { Relatorio } from "../lib/relatorio"

// Números conhecidos (centavos de EUR). Conferência: 125000 - 14500 = 110500.
export const REL: Relatorio = {
  ciclo: { inicio: "2026-09-10", fim: "2026-10-09", estado: "rascunho", ultima_versao: null },
  cambio: { data_referencia: "2026-10-09", taxas: [{ moeda: "BRL", taxa: 6.25, data: "2026-10-09", fonte_url: "https://exemplo.invalid/bce" }] },
  receita: { stripe: 100000, externa: 25000, bruta: 125000 },
  deducoes: { vat: 10000, estornos: 5000, estornos_vat: 500, total: 14500 },
  receita_base: 110500,
  clientes_ativos: { quantidade: 42, lista: [{ chave: "cliente-1", origem: "assinatura" }] },
  ia: { avulsa: 3000, rateio: 2000, total: 5000, por_nivel: [{ nivel: "grupo", receita_liquida: 50000, horas_ia: 2, horas_total: 10, rateio: 2000 }] },
  faixa: { faixa: 1, limites: [100, 500], percentual: null, valor: null },
  pendencias: [{ tipo: "faixa_percentuais_indefinidos" }],
  linhas: [
    { fonte: "stripe", ref_id: 1, data: "2026-09-15", conta_ou_origem: "acct_x", cliente: "a@exemplo.invalid", moeda: "EUR", bruto: 100000, vat: 10000, taxa: 1, bruto_eur: 100000, vat_eur: 10000, referencia: "in_1" },
    { fonte: "externa", ref_id: 7, data: "2026-09-20", conta_ou_origem: "pix", cliente: "Cliente Pix", moeda: "EUR", bruto: 25000, vat: 0, taxa: 1, bruto_eur: 25000, vat_eur: 0, referencia: "2026/comp.pdf" },
  ],
  csv: "fonte;ref_id\nstripe;1",
}
