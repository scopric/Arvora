
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assinaturas": {
                  Row: {
                    "atualizado_em": string,"cancela_no_fim": boolean,"cancelada_em": string | null,"conta_stripe_id": number | null,"criado_em": string,"id": number,"origem": Database["public"]['Enums']["origem_assinatura"],"perfil_id": string | null,"periodo_fim": string,"periodo_inicio": string,"plano_id": number,"receita_externa_id": number | null,"status": Database["public"]['Enums']["status_assinatura"],"stripe_evento_em": string | null,"stripe_subscription_id": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"cancela_no_fim"?: boolean,"cancelada_em"?: string | null,"conta_stripe_id"?: number | null,"criado_em"?: string,"id"?: never,"origem"?: Database["public"]['Enums']["origem_assinatura"],"perfil_id"?: string | null,"periodo_fim": string,"periodo_inicio": string,"plano_id": number,"receita_externa_id"?: number | null,"status": Database["public"]['Enums']["status_assinatura"],"stripe_evento_em"?: string | null,"stripe_subscription_id"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"cancela_no_fim"?: boolean,"cancelada_em"?: string | null,"conta_stripe_id"?: number | null,"criado_em"?: string,"id"?: never,"origem"?: Database["public"]['Enums']["origem_assinatura"],"perfil_id"?: string | null,"periodo_fim"?: string,"periodo_inicio"?: string,"plano_id"?: number,"receita_externa_id"?: number | null,"status"?: Database["public"]['Enums']["status_assinatura"],"stripe_evento_em"?: string | null,"stripe_subscription_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assinaturas_conta_stripe_id_fkey"
      columns: ["conta_stripe_id"]
isOneToOne: false
      referencedRelation: "contas_stripe"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assinaturas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assinaturas_plano_id_fkey"
      columns: ["plano_id"]
isOneToOne: false
      referencedRelation: "planos"
      referencedColumns: ["id"]
    }
                  ]
                },"clientes_stripe": {
                  Row: {
                    "conta_stripe_id": number,"criado_em": string,"email": string,"id": number,"perfil_id": string | null,"stripe_customer_id": string
                  }
                  Insert: {
                    "conta_stripe_id": number,"criado_em"?: string,"email": string,"id"?: never,"perfil_id"?: string | null,"stripe_customer_id": string
                  }
                  Update: {
                    "conta_stripe_id"?: number,"criado_em"?: string,"email"?: string,"id"?: never,"perfil_id"?: string | null,"stripe_customer_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clientes_stripe_conta_stripe_id_fkey"
      columns: ["conta_stripe_id"]
isOneToOne: false
      referencedRelation: "contas_stripe"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "clientes_stripe_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"contas_stripe": {
                  Row: {
                    "ativa": boolean,"criado_em": string,"id": number,"pais": string,"stripe_account_id": string,"titular": string
                  }
                  Insert: {
                    "ativa"?: boolean,"criado_em"?: string,"id"?: never,"pais": string,"stripe_account_id": string,"titular": string
                  }
                  Update: {
                    "ativa"?: boolean,"criado_em"?: string,"id"?: never,"pais"?: string,"stripe_account_id"?: string,"titular"?: string
                  }
                  Relationships: [
                    
                  ]
                },"equipe": {
                  Row: {
                    "criado_em": string,"criado_por": string | null,"papel": Database["public"]['Enums']["papel_equipe"],"perfil_id": string
                  }
                  Insert: {
                    "criado_em"?: string,"criado_por"?: string | null,"papel": Database["public"]['Enums']["papel_equipe"],"perfil_id": string
                  }
                  Update: {
                    "criado_em"?: string,"criado_por"?: string | null,"papel"?: Database["public"]['Enums']["papel_equipe"],"perfil_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "equipe_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: true
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    }
                  ]
                },"eventos_stripe": {
                  Row: {
                    "conta_stripe_id": number,"criado_em": string,"criado_stripe_em": string,"erro": string | null,"event_id": string,"id": number,"payload": Json | null,"processado_em": string | null,"tipo": string
                  }
                  Insert: {
                    "conta_stripe_id": number,"criado_em"?: string,"criado_stripe_em": string,"erro"?: string | null,"event_id": string,"id"?: never,"payload"?: Json | null,"processado_em"?: string | null,"tipo": string
                  }
                  Update: {
                    "conta_stripe_id"?: number,"criado_em"?: string,"criado_stripe_em"?: string,"erro"?: string | null,"event_id"?: string,"id"?: never,"payload"?: Json | null,"processado_em"?: string | null,"tipo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventos_stripe_conta_stripe_id_fkey"
      columns: ["conta_stripe_id"]
isOneToOne: false
      referencedRelation: "contas_stripe"
      referencedColumns: ["id"]
    }
                  ]
                },"perfis": {
                  Row: {
                    "atualizado_em": string,"bio": string | null,"cidade": string | null,"criado_em": string,"empresa_nome": string | null,"foto_path": string | null,"id": string,"instagram": string | null,"linkedin_url": string | null,"maior_18_em": string,"nome": string,"onboarding_em": string | null,"pais": string | null,"publico_aprovado_em": string | null,"setor_id": number | null,"slug": string | null,"suspenso_em": string | null,"visibilidade": Database["public"]['Enums']["visibilidade_perfil"]
                  }
                  Insert: {
                    "atualizado_em"?: string,"bio"?: string | null,"cidade"?: string | null,"criado_em"?: string,"empresa_nome"?: string | null,"foto_path"?: string | null,"id": string,"instagram"?: string | null,"linkedin_url"?: string | null,"maior_18_em": string,"nome": string,"onboarding_em"?: string | null,"pais"?: string | null,"publico_aprovado_em"?: string | null,"setor_id"?: number | null,"slug"?: string | null,"suspenso_em"?: string | null,"visibilidade"?: Database["public"]['Enums']["visibilidade_perfil"]
                  }
                  Update: {
                    "atualizado_em"?: string,"bio"?: string | null,"cidade"?: string | null,"criado_em"?: string,"empresa_nome"?: string | null,"foto_path"?: string | null,"id"?: string,"instagram"?: string | null,"linkedin_url"?: string | null,"maior_18_em"?: string,"nome"?: string,"onboarding_em"?: string | null,"pais"?: string | null,"publico_aprovado_em"?: string | null,"setor_id"?: number | null,"slug"?: string | null,"suspenso_em"?: string | null,"visibilidade"?: Database["public"]['Enums']["visibilidade_perfil"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfis_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"planos": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"conta_stripe_id": number,"criado_em": string,"id": number,"intervalo": string,"moeda": string,"nivel": Database["public"]['Enums']["nivel_acesso"] | null,"nome": string,"stripe_price_id": string,"tipo_receita": Database["public"]['Enums']["tipo_receita"],"valor_centavos": number,"vertical_id": number | null
                  }
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"conta_stripe_id": number,"criado_em"?: string,"id"?: never,"intervalo": string,"moeda": string,"nivel"?: Database["public"]['Enums']["nivel_acesso"] | null,"nome": string,"stripe_price_id": string,"tipo_receita": Database["public"]['Enums']["tipo_receita"],"valor_centavos": number,"vertical_id"?: number | null
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"conta_stripe_id"?: number,"criado_em"?: string,"id"?: never,"intervalo"?: string,"moeda"?: string,"nivel"?: Database["public"]['Enums']["nivel_acesso"] | null,"nome"?: string,"stripe_price_id"?: string,"tipo_receita"?: Database["public"]['Enums']["tipo_receita"],"valor_centavos"?: number,"vertical_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "planos_conta_stripe_id_fkey"
      columns: ["conta_stripe_id"]
isOneToOne: false
      referencedRelation: "contas_stripe"
      referencedColumns: ["id"]
    }
                  ]
                },"setores": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"criado_em": string,"id": number,"nome": string,"ordem": number,"slug": string
                  }
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome": string,"ordem"?: number,"slug": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome"?: string,"ordem"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "aprovar_perfil_publico":
{ Args: { "aprovar"?: boolean,"perfil": string }; Returns: undefined
                           },
"consumir_limite":
{ Args: { "p_acao": string }; Returns: boolean
                           },
"exportar_meus_dados":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"pode_ver_conteudo":
{ Args: { "minimo": Database["public"]['Enums']["nivel_acesso"] }; Returns: boolean
                           },
"processar_evento_stripe":
{ Args: { "p_conta_stripe_id": number,"p_evento": Json }; Returns: string
                           },
"tem_acesso":
{ Args: { "minimo": Database["public"]['Enums']["nivel_acesso"] }; Returns: boolean
                           }
          }
          Enums: {
            "nivel_acesso": "visitante"|"clube"|"grupo","origem_assinatura": "stripe"|"manual","papel_equipe": "super_admin"|"editor"|"corretor"|"moderador"|"auditor","status_assinatura": "incomplete"|"incomplete_expired"|"trialing"|"active"|"past_due"|"canceled"|"unpaid"|"paused","tipo_receita": "assinatura"|"curso"|"produto_digital"|"ingresso","visibilidade_perfil": "membros"|"publico"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "nivel_acesso": ["visitante", "clube", "grupo"],"origem_assinatura": ["stripe", "manual"],"papel_equipe": ["super_admin", "editor", "corretor", "moderador", "auditor"],"status_assinatura": ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"],"tipo_receita": ["assinatura", "curso", "produto_digital", "ingresso"],"visibilidade_perfil": ["membros", "publico"]
          }
        }
} as const

