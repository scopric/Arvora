export type LinhaRel = { fonte: string; ref_id: number; data: string; conta_ou_origem: string; cliente: string | null; moeda: string; bruto: number; vat: number | null; taxa: number | null; bruto_eur: number | null; vat_eur: number | null; referencia: string | null }
export type Relatorio = {
  ciclo: { inicio: string; fim: string; estado: "rascunho" | "fechado"; ultima_versao: number | null }
  cambio: { data_referencia: string; taxas: { moeda: string; taxa: number; data: string | null; fonte_url: string | null }[] }
  receita: { stripe: number; externa: number; bruta: number }
  deducoes: { vat: number; estornos: number; estornos_vat: number; total: number }
  receita_base: number
  clientes_ativos: { quantidade: number; lista: { chave: string; origem: string }[] }
  ia: { avulsa: number; rateio: number; total: number; por_nivel: { nivel: string; receita_liquida: number; horas_ia: number; horas_total: number; rateio: number }[] }
  faixa: { faixa: number; limites: number[]; percentual: number | null; valor: number | null }
  pendencias: { tipo: string; moeda?: string; pagamento_id?: number; item_id?: number }[]
  linhas: LinhaRel[]
  csv: string
}
export type Plano = { id: number; nome: string }
export type Versao = { versao: number; dados: Relatorio; enviado_em: string | null; reaberto_em: string | null; motivo_reabertura: string | null; csv_sha256: string; criado_em: string }

export type Receita = { id: number; cliente_nome: string; plano_id: number | null; perfil_id: string | null; moeda: string; bruto_centavos: number; recebido_em: string }
