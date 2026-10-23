
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "equipe": {
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
                           }
          }
          Enums: {
            "nivel_acesso": "visitante"|"clube"|"grupo","papel_equipe": "super_admin"|"editor"|"corretor"|"moderador"|"auditor","visibilidade_perfil": "membros"|"publico"
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
            "nivel_acesso": ["visitante", "clube", "grupo"],"papel_equipe": ["super_admin", "editor", "corretor", "moderador", "auditor"],"visibilidade_perfil": ["membros", "publico"]
          }
        }
} as const

