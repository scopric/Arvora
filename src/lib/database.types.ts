
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "agenda_evento": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"descricao": string | null,"edicao_id": number,"fim_em": string | null,"id": number,"inicio_em": string,"local": string | null,"titulo": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"edicao_id": number,"fim_em"?: string | null,"id"?: never,"inicio_em": string,"local"?: string | null,"titulo": string
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"edicao_id"?: number,"fim_em"?: string | null,"id"?: never,"inicio_em"?: string,"local"?: string | null,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "agenda_evento_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "agenda_evento_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes_publicas"
      referencedColumns: ["id"]
    }
                  ]
                },"assinaturas": {
                  Row: {
                    "atualizado_em": string,"cancela_no_fim": boolean,"cancelada_em": string | null,"conta_stripe_id": number | null,"criado_em": string,"id": number,"origem": Database["public"]['Enums']["origem_assinatura"],"perfil_id": string | null,"periodo_fim": string,"periodo_inicio": string,"plano_id": number,"receita_externa_id": number | null,"status": Database["public"]['Enums']["status_assinatura"],"stripe_criada_em": string | null,"stripe_evento_em": string | null,"stripe_subscription_id": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"cancela_no_fim"?: boolean,"cancelada_em"?: string | null,"conta_stripe_id"?: number | null,"criado_em"?: string,"id"?: never,"origem"?: Database["public"]['Enums']["origem_assinatura"],"perfil_id"?: string | null,"periodo_fim": string,"periodo_inicio": string,"plano_id": number,"receita_externa_id"?: number | null,"status": Database["public"]['Enums']["status_assinatura"],"stripe_criada_em"?: string | null,"stripe_evento_em"?: string | null,"stripe_subscription_id"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"cancela_no_fim"?: boolean,"cancelada_em"?: string | null,"conta_stripe_id"?: number | null,"criado_em"?: string,"id"?: never,"origem"?: Database["public"]['Enums']["origem_assinatura"],"perfil_id"?: string | null,"periodo_fim"?: string,"periodo_inicio"?: string,"plano_id"?: number,"receita_externa_id"?: number | null,"status"?: Database["public"]['Enums']["status_assinatura"],"stripe_criada_em"?: string | null,"stripe_evento_em"?: string | null,"stripe_subscription_id"?: string | null
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
      foreignKeyName: "assinaturas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assinaturas_plano_id_fkey"
      columns: ["plano_id"]
isOneToOne: false
      referencedRelation: "planos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assinaturas_receita_externa_id_fkey"
      columns: ["receita_externa_id"]
isOneToOne: false
      referencedRelation: "receitas_externas"
      referencedColumns: ["id"]
    }
                  ]
                },"assinaturas_status": {
                  Row: {
                    "assinatura_id": number,"criado_em": string,"desde": string,"id": number,"plano_id": number,"status": Database["public"]['Enums']["status_assinatura"]
                  }
                  Insert: {
                    "assinatura_id": number,"criado_em"?: string,"desde": string,"id"?: never,"plano_id": number,"status": Database["public"]['Enums']["status_assinatura"]
                  }
                  Update: {
                    "assinatura_id"?: number,"criado_em"?: string,"desde"?: string,"id"?: never,"plano_id"?: number,"status"?: Database["public"]['Enums']["status_assinatura"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "assinaturas_status_assinatura_id_fkey"
      columns: ["assinatura_id"]
isOneToOne: false
      referencedRelation: "assinaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assinaturas_status_plano_id_fkey"
      columns: ["plano_id"]
isOneToOne: false
      referencedRelation: "planos"
      referencedColumns: ["id"]
    }
                  ]
                },"aulas": {
                  Row: {
                    "agendada_em": string | null,"atualizado_em": string,"criado_em": string,"descricao": string | null,"duracao_min": number | null,"especialista_id": string | null,"id": number,"inicio_em": string | null,"materiais_publicados_em": string | null,"modulo_id": number | null,"nivel_minimo": Database["public"]['Enums']["nivel_acesso"],"ordem": number,"slug": string,"tipo": Database["public"]['Enums']["tipo_aula"],"titulo": string,"trailer_video_id": string | null,"vertical_id": number,"video_id": string | null
                  }
                  Insert: {
                    "agendada_em"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"duracao_min"?: number | null,"especialista_id"?: string | null,"id"?: never,"inicio_em"?: string | null,"materiais_publicados_em"?: string | null,"modulo_id"?: number | null,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"ordem"?: number,"slug": string,"tipo": Database["public"]['Enums']["tipo_aula"],"titulo": string,"trailer_video_id"?: string | null,"vertical_id": number,"video_id"?: string | null
                  }
                  Update: {
                    "agendada_em"?: string | null,"atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"duracao_min"?: number | null,"especialista_id"?: string | null,"id"?: never,"inicio_em"?: string | null,"materiais_publicados_em"?: string | null,"modulo_id"?: number | null,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"ordem"?: number,"slug"?: string,"tipo"?: Database["public"]['Enums']["tipo_aula"],"titulo"?: string,"trailer_video_id"?: string | null,"vertical_id"?: number,"video_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "aulas_especialista_id_fkey"
      columns: ["especialista_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aulas_especialista_id_fkey"
      columns: ["especialista_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aulas_modulo_id_fkey"
      columns: ["modulo_id"]
isOneToOne: false
      referencedRelation: "modulos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "aulas_vertical_id_fkey"
      columns: ["vertical_id"]
isOneToOne: false
      referencedRelation: "verticais"
      referencedColumns: ["id"]
    }
                  ]
                },"cambio_bce": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"data": string,"fonte_url": string,"moeda": string,"taxa": number
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"data": string,"fonte_url": string,"moeda": string,"taxa": number
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"data"?: string,"fonte_url"?: string,"moeda"?: string,"taxa"?: number
                  }
                  Relationships: [
                    
                  ]
                },"categorias_premio": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"edicao_id": number,"id": number,"nome": string,"ordem": number,"slug": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"edicao_id": number,"id"?: never,"nome": string,"ordem"?: number,"slug": string
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"edicao_id"?: number,"id"?: never,"nome"?: string,"ordem"?: number,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categorias_premio_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categorias_premio_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes_publicas"
      referencedColumns: ["id"]
    }
                  ]
                },"categorias_rede": {
                  Row: {
                    "ativa": boolean,"atualizado_em": string,"criado_em": string,"id": number,"nome": string,"nome_en": string | null,"ordem": number,"slug": string
                  }
                  Insert: {
                    "ativa"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome": string,"nome_en"?: string | null,"ordem"?: number,"slug": string
                  }
                  Update: {
                    "ativa"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome"?: string,"nome_en"?: string | null,"ordem"?: number,"slug"?: string
                  }
                  Relationships: [
                    
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
    },{
      foreignKeyName: "clientes_stripe_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"comentarios": {
                  Row: {
                    "autor_id": string | null,"corpo": string,"criado_em": string,"editado_em": string | null,"id": number,"oculto_em": string | null,"oculto_por": string | null,"post_id": number
                  }
                  Insert: {
                    "autor_id"?: string | null,"corpo": string,"criado_em"?: string,"editado_em"?: string | null,"id"?: never,"oculto_em"?: string | null,"oculto_por"?: string | null,"post_id": number
                  }
                  Update: {
                    "autor_id"?: string | null,"corpo"?: string,"criado_em"?: string,"editado_em"?: string | null,"id"?: never,"oculto_em"?: string | null,"oculto_por"?: string | null,"post_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "comentarios_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comentarios_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comentarios_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"conexoes": {
                  Row: {
                    "criado_em": string,"destinatario_id": string,"id": number,"mensagem": string | null,"origem": Database["public"]['Enums']["origem_conexao"],"pedida_em": string,"respondida_em": string | null,"solicitante_id": string,"status": Database["public"]['Enums']["status_conexao"]
                  }
                  Insert: {
                    "criado_em"?: string,"destinatario_id": string,"id"?: never,"mensagem"?: string | null,"origem": Database["public"]['Enums']["origem_conexao"],"pedida_em"?: string,"respondida_em"?: string | null,"solicitante_id"?: string,"status"?: Database["public"]['Enums']["status_conexao"]
                  }
                  Update: {
                    "criado_em"?: string,"destinatario_id"?: string,"id"?: never,"mensagem"?: string | null,"origem"?: Database["public"]['Enums']["origem_conexao"],"pedida_em"?: string,"respondida_em"?: string | null,"solicitante_id"?: string,"status"?: Database["public"]['Enums']["status_conexao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "conexoes_destinatario_id_fkey"
      columns: ["destinatario_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conexoes_destinatario_id_fkey"
      columns: ["destinatario_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conexoes_solicitante_id_fkey"
      columns: ["solicitante_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conexoes_solicitante_id_fkey"
      columns: ["solicitante_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"consentimentos": {
                  Row: {
                    "aceito_em": string,"criado_em": string,"documento_id": number,"evidencia": string | null,"id": number,"perfil_id": string | null,"registrado_por": string | null,"revogado_em": string | null,"titular_email": string,"titular_nome": string | null
                  }
                  Insert: {
                    "aceito_em"?: string,"criado_em"?: string,"documento_id": number,"evidencia"?: string | null,"id"?: never,"perfil_id"?: string | null,"registrado_por"?: string | null,"revogado_em"?: string | null,"titular_email": string,"titular_nome"?: string | null
                  }
                  Update: {
                    "aceito_em"?: string,"criado_em"?: string,"documento_id"?: number,"evidencia"?: string | null,"id"?: never,"perfil_id"?: string | null,"registrado_por"?: string | null,"revogado_em"?: string | null,"titular_email"?: string,"titular_nome"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consentimentos_documento_id_fkey"
      columns: ["documento_id"]
isOneToOne: false
      referencedRelation: "documentos_legais"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consentimentos_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consentimentos_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
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
                },"cursos": {
                  Row: {
                    "atualizado_em": string,"capa_path": string | null,"criado_em": string,"descricao": string | null,"id": number,"nivel_minimo": Database["public"]['Enums']["nivel_acesso"],"ordem": number,"publicado_em": string | null,"slug": string,"titulo": string,"vertical_id": number
                  }
                  Insert: {
                    "atualizado_em"?: string,"capa_path"?: string | null,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"ordem"?: number,"publicado_em"?: string | null,"slug": string,"titulo": string,"vertical_id": number
                  }
                  Update: {
                    "atualizado_em"?: string,"capa_path"?: string | null,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"ordem"?: number,"publicado_em"?: string | null,"slug"?: string,"titulo"?: string,"vertical_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "cursos_vertical_id_fkey"
      columns: ["vertical_id"]
isOneToOne: false
      referencedRelation: "verticais"
      referencedColumns: ["id"]
    }
                  ]
                },"curtidas": {
                  Row: {
                    "criado_em": string,"perfil_id": string,"post_id": number
                  }
                  Insert: {
                    "criado_em"?: string,"perfil_id"?: string,"post_id": number
                  }
                  Update: {
                    "criado_em"?: string,"perfil_id"?: string,"post_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "curtidas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "curtidas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "curtidas_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"denuncias": {
                  Row: {
                    "comentario_id": number | null,"conexao_id": number | null,"criado_em": string,"denunciante_id": string | null,"empresa_id": number | null,"id": number,"motivo": string,"perfil_denunciado_id": string | null,"post_id": number | null,"resolvida_em": string | null,"resolvida_por": string | null,"status": Database["public"]['Enums']["status_denuncia"],"texto": string | null
                  }
                  Insert: {
                    "comentario_id"?: number | null,"conexao_id"?: number | null,"criado_em"?: string,"denunciante_id"?: string | null,"empresa_id"?: number | null,"id"?: never,"motivo": string,"perfil_denunciado_id"?: string | null,"post_id"?: number | null,"resolvida_em"?: string | null,"resolvida_por"?: string | null,"status"?: Database["public"]['Enums']["status_denuncia"],"texto"?: string | null
                  }
                  Update: {
                    "comentario_id"?: number | null,"conexao_id"?: number | null,"criado_em"?: string,"denunciante_id"?: string | null,"empresa_id"?: number | null,"id"?: never,"motivo"?: string,"perfil_denunciado_id"?: string | null,"post_id"?: number | null,"resolvida_em"?: string | null,"resolvida_por"?: string | null,"status"?: Database["public"]['Enums']["status_denuncia"],"texto"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "denuncias_comentario_id_fkey"
      columns: ["comentario_id"]
isOneToOne: false
      referencedRelation: "comentarios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_conexao_id_fkey"
      columns: ["conexao_id"]
isOneToOne: false
      referencedRelation: "conexoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_denunciante_id_fkey"
      columns: ["denunciante_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_denunciante_id_fkey"
      columns: ["denunciante_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_perfil_denunciado_id_fkey"
      columns: ["perfil_denunciado_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_perfil_denunciado_id_fkey"
      columns: ["perfil_denunciado_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "denuncias_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["id"]
    }
                  ]
                },"documentos_legais": {
                  Row: {
                    "conteudo_md": string,"criado_em": string,"id": number,"idioma": string,"publicado_por": string | null,"sha256": string,"tipo": Database["public"]['Enums']["tipo_documento"],"titulo": string,"versao": string,"vigente_desde": string
                  }
                  Insert: {
                    "conteudo_md": string,"criado_em"?: string,"id"?: never,"idioma": string,"publicado_por"?: string | null,"sha256": string,"tipo": Database["public"]['Enums']["tipo_documento"],"titulo": string,"versao": string,"vigente_desde"?: string
                  }
                  Update: {
                    "conteudo_md"?: string,"criado_em"?: string,"id"?: never,"idioma"?: string,"publicado_por"?: string | null,"sha256"?: string,"tipo"?: Database["public"]['Enums']["tipo_documento"],"titulo"?: string,"versao"?: string,"vigente_desde"?: string
                  }
                  Relationships: [
                    
                  ]
                },"edicoes": {
                  Row: {
                    "ano": number,"atualizado_em": string,"cidade": string,"criado_em": string,"descricao": string | null,"durante_fim": string,"durante_inicio": string,"gravacao_video_id": string | null,"id": number,"nome": string,"pais": string,"publicada_em": string | null,"slug": string,"transmissao_url": string | null,"fase": string | null
                  }
                  Insert: {
                    "ano": number,"atualizado_em"?: string,"cidade": string,"criado_em"?: string,"descricao"?: string | null,"durante_fim": string,"durante_inicio": string,"gravacao_video_id"?: string | null,"id"?: never,"nome": string,"pais": string,"publicada_em"?: string | null,"slug": string,"transmissao_url"?: string | null
                  }
                  Update: {
                    "ano"?: number,"atualizado_em"?: string,"cidade"?: string,"criado_em"?: string,"descricao"?: string | null,"durante_fim"?: string,"durante_inicio"?: string,"gravacao_video_id"?: string | null,"id"?: never,"nome"?: string,"pais"?: string,"publicada_em"?: string | null,"slug"?: string,"transmissao_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"empresas": {
                  Row: {
                    "aprovada_em": string | null,"aprovada_por": string | null,"atualizado_em": string,"cidade": string | null,"criado_em": string,"descricao": string | null,"dono_perfil_id": string | null,"id": number,"logo_path": string | null,"motivo_recusa": string | null,"nome": string,"pais": string | null,"setor_id": number,"site": string | null,"slug": string,"status": Database["public"]['Enums']["status_moderacao"]
                  }
                  Insert: {
                    "aprovada_em"?: string | null,"aprovada_por"?: string | null,"atualizado_em"?: string,"cidade"?: string | null,"criado_em"?: string,"descricao"?: string | null,"dono_perfil_id"?: string | null,"id"?: never,"logo_path"?: string | null,"motivo_recusa"?: string | null,"nome": string,"pais"?: string | null,"setor_id": number,"site"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["status_moderacao"]
                  }
                  Update: {
                    "aprovada_em"?: string | null,"aprovada_por"?: string | null,"atualizado_em"?: string,"cidade"?: string | null,"criado_em"?: string,"descricao"?: string | null,"dono_perfil_id"?: string | null,"id"?: never,"logo_path"?: string | null,"motivo_recusa"?: string | null,"nome"?: string,"pais"?: string | null,"setor_id"?: number,"site"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["status_moderacao"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "empresas_dono_perfil_id_fkey"
      columns: ["dono_perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "empresas_dono_perfil_id_fkey"
      columns: ["dono_perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "empresas_setor_id_fkey"
      columns: ["setor_id"]
isOneToOne: false
      referencedRelation: "setores"
      referencedColumns: ["id"]
    }
                  ]
                },"entregas": {
                  Row: {
                    "arquivo_path": string | null,"atualizado_em": string,"corrigido_em": string | null,"corrigido_por": string | null,"criado_em": string,"devolutiva": string | null,"enviada_em": string,"exercicio_id": number,"id": number,"perfil_id": string,"status": Database["public"]['Enums']["status_entrega"],"texto": string | null
                  }
                  Insert: {
                    "arquivo_path"?: string | null,"atualizado_em"?: string,"corrigido_em"?: string | null,"corrigido_por"?: string | null,"criado_em"?: string,"devolutiva"?: string | null,"enviada_em"?: string,"exercicio_id": number,"id"?: never,"perfil_id": string,"status"?: Database["public"]['Enums']["status_entrega"],"texto"?: string | null
                  }
                  Update: {
                    "arquivo_path"?: string | null,"atualizado_em"?: string,"corrigido_em"?: string | null,"corrigido_por"?: string | null,"criado_em"?: string,"devolutiva"?: string | null,"enviada_em"?: string,"exercicio_id"?: number,"id"?: never,"perfil_id"?: string,"status"?: Database["public"]['Enums']["status_entrega"],"texto"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entregas_exercicio_id_fkey"
      columns: ["exercicio_id"]
isOneToOne: false
      referencedRelation: "exercicios"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entregas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entregas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
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
    },{
      foreignKeyName: "equipe_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: true
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"espacos": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"descricao": string | null,"id": number,"nivel_minimo": Database["public"]['Enums']["nivel_acesso"],"ordem": number,"slug": string,"titulo": string,"titulo_en": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"nivel_minimo": Database["public"]['Enums']["nivel_acesso"],"ordem"?: number,"slug": string,"titulo": string,"titulo_en"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"ordem"?: number,"slug"?: string,"titulo"?: string,"titulo_en"?: string | null
                  }
                  Relationships: [
                    
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
                },"exercicios": {
                  Row: {
                    "aceita_arquivo": boolean,"atualizado_em": string,"aula_id": number,"criado_em": string,"enunciado_md": string,"id": number,"ordem": number,"prazo_dias": number | null
                  }
                  Insert: {
                    "aceita_arquivo"?: boolean,"atualizado_em"?: string,"aula_id": number,"criado_em"?: string,"enunciado_md": string,"id"?: never,"ordem": number,"prazo_dias"?: number | null
                  }
                  Update: {
                    "aceita_arquivo"?: boolean,"atualizado_em"?: string,"aula_id"?: number,"criado_em"?: string,"enunciado_md"?: string,"id"?: never,"ordem"?: number,"prazo_dias"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "exercicios_aula_id_fkey"
      columns: ["aula_id"]
isOneToOne: false
      referencedRelation: "aulas"
      referencedColumns: ["id"]
    }
                  ]
                },"indicados": {
                  Row: {
                    "atualizado_em": string,"categoria_id": number,"consentimento_id": number | null,"convite_email": string | null,"criado_em": string,"edicao_id": number,"empresa_id": number | null,"foto_path": string | null,"id": number,"nome": string,"perfil_id": string | null,"publicado_em": string | null,"resumo": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"categoria_id": number,"consentimento_id"?: number | null,"convite_email"?: string | null,"criado_em"?: string,"edicao_id": number,"empresa_id"?: number | null,"foto_path"?: string | null,"id"?: never,"nome": string,"perfil_id"?: string | null,"publicado_em"?: string | null,"resumo"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"categoria_id"?: number,"consentimento_id"?: number | null,"convite_email"?: string | null,"criado_em"?: string,"edicao_id"?: number,"empresa_id"?: number | null,"foto_path"?: string | null,"id"?: never,"nome"?: string,"perfil_id"?: string | null,"publicado_em"?: string | null,"resumo"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "indicados_categoria_id_edicao_id_fkey"
      columns: ["categoria_id","edicao_id"]
isOneToOne: false
      referencedRelation: "categorias_premio"
      referencedColumns: ["id","edicao_id"]
    },{
      foreignKeyName: "indicados_consentimento_id_fkey"
      columns: ["consentimento_id"]
isOneToOne: false
      referencedRelation: "consentimentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "indicados_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "indicados_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes_publicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "indicados_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "indicados_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "indicados_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"log_admin": {
                  Row: {
                    "acao": string,"alvo_id": string | null,"antes": Json | null,"ator_id": string,"criado_em": string,"depois": Json | null,"id": number,"tabela": string
                  }
                  Insert: {
                    "acao": string,"alvo_id"?: string | null,"antes"?: Json | null,"ator_id": string,"criado_em"?: string,"depois"?: Json | null,"id"?: never,"tabela": string
                  }
                  Update: {
                    "acao"?: string,"alvo_id"?: string | null,"antes"?: Json | null,"ator_id"?: string,"criado_em"?: string,"depois"?: Json | null,"id"?: never,"tabela"?: string
                  }
                  Relationships: [
                    
                  ]
                },"materiais_aula": {
                  Row: {
                    "aprovado_em": string | null,"aprovado_por": string | null,"arquivo_path": string | null,"atualizado_em": string,"aula_id": number,"conteudo_md": string | null,"criado_em": string,"id": number,"status": Database["public"]['Enums']["status_material"],"tipo": Database["public"]['Enums']["tipo_material"]
                  }
                  Insert: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"arquivo_path"?: string | null,"atualizado_em"?: string,"aula_id": number,"conteudo_md"?: string | null,"criado_em"?: string,"id"?: never,"status"?: Database["public"]['Enums']["status_material"],"tipo": Database["public"]['Enums']["tipo_material"]
                  }
                  Update: {
                    "aprovado_em"?: string | null,"aprovado_por"?: string | null,"arquivo_path"?: string | null,"atualizado_em"?: string,"aula_id"?: number,"conteudo_md"?: string | null,"criado_em"?: string,"id"?: never,"status"?: Database["public"]['Enums']["status_material"],"tipo"?: Database["public"]['Enums']["tipo_material"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "materiais_aula_aula_id_fkey"
      columns: ["aula_id"]
isOneToOne: false
      referencedRelation: "aulas"
      referencedColumns: ["id"]
    }
                  ]
                },"modulos": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"curso_id": number,"id": number,"ordem": number,"titulo": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"curso_id": number,"id"?: never,"ordem": number,"titulo": string
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"curso_id"?: number,"id"?: never,"ordem"?: number,"titulo"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modulos_curso_id_fkey"
      columns: ["curso_id"]
isOneToOne: false
      referencedRelation: "cursos"
      referencedColumns: ["id"]
    }
                  ]
                },"network_itens": {
                  Row: {
                    "atualizado_em": string,"categoria_id": number,"criado_em": string,"id": number,"perfil_id": string,"texto": string | null,"tipo": Database["public"]['Enums']["tipo_network"]
                  }
                  Insert: {
                    "atualizado_em"?: string,"categoria_id": number,"criado_em"?: string,"id"?: never,"perfil_id"?: string,"texto"?: string | null,"tipo": Database["public"]['Enums']["tipo_network"]
                  }
                  Update: {
                    "atualizado_em"?: string,"categoria_id"?: number,"criado_em"?: string,"id"?: never,"perfil_id"?: string,"texto"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_network"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "network_itens_categoria_id_fkey"
      columns: ["categoria_id"]
isOneToOne: false
      referencedRelation: "categorias_rede"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "network_itens_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "network_itens_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"notificacoes": {
                  Row: {
                    "criado_em": string,"id": number,"lida_em": string | null,"link": string | null,"perfil_id": string,"tipo": Database["public"]['Enums']["tipo_notificacao"],"titulo": string,"titulo_en": string | null
                  }
                  Insert: {
                    "criado_em"?: string,"id"?: never,"lida_em"?: string | null,"link"?: string | null,"perfil_id": string,"tipo": Database["public"]['Enums']["tipo_notificacao"],"titulo": string,"titulo_en"?: string | null
                  }
                  Update: {
                    "criado_em"?: string,"id"?: never,"lida_em"?: string | null,"link"?: string | null,"perfil_id"?: string,"tipo"?: Database["public"]['Enums']["tipo_notificacao"],"titulo"?: string,"titulo_en"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notificacoes_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notificacoes_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"pagamentos": {
                  Row: {
                    "assinatura_id": number | null,"bruto_centavos": number,"cliente_email": string,"conta_stripe_id": number,"criado_em": string,"id": number,"metodo": string | null,"moeda": string,"pago_em": string,"perfil_id": string | null,"stripe_invoice_id": string | null,"stripe_payment_intent_id": string | null,"vat_centavos": number
                  }
                  Insert: {
                    "assinatura_id"?: number | null,"bruto_centavos": number,"cliente_email": string,"conta_stripe_id": number,"criado_em"?: string,"id"?: never,"metodo"?: string | null,"moeda": string,"pago_em": string,"perfil_id"?: string | null,"stripe_invoice_id"?: string | null,"stripe_payment_intent_id"?: string | null,"vat_centavos"?: number
                  }
                  Update: {
                    "assinatura_id"?: number | null,"bruto_centavos"?: number,"cliente_email"?: string,"conta_stripe_id"?: number,"criado_em"?: string,"id"?: never,"metodo"?: string | null,"moeda"?: string,"pago_em"?: string,"perfil_id"?: string | null,"stripe_invoice_id"?: string | null,"stripe_payment_intent_id"?: string | null,"vat_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagamentos_assinatura_id_fkey"
      columns: ["assinatura_id"]
isOneToOne: false
      referencedRelation: "assinaturas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_conta_stripe_id_fkey"
      columns: ["conta_stripe_id"]
isOneToOne: false
      referencedRelation: "contas_stripe"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"pagamentos_itens": {
                  Row: {
                    "bruto_centavos": number,"criado_em": string,"descricao": string | null,"id": number,"pagamento_id": number,"plano_id": number | null,"tipo_receita": Database["public"]['Enums']["tipo_receita"],"vat_centavos": number
                  }
                  Insert: {
                    "bruto_centavos": number,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"pagamento_id": number,"plano_id"?: number | null,"tipo_receita": Database["public"]['Enums']["tipo_receita"],"vat_centavos"?: number
                  }
                  Update: {
                    "bruto_centavos"?: number,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"pagamento_id"?: number,"plano_id"?: number | null,"tipo_receita"?: Database["public"]['Enums']["tipo_receita"],"vat_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pagamentos_itens_pagamento_id_fkey"
      columns: ["pagamento_id"]
isOneToOne: false
      referencedRelation: "pagamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pagamentos_itens_plano_id_fkey"
      columns: ["plano_id"]
isOneToOne: false
      referencedRelation: "planos"
      referencedColumns: ["id"]
    }
                  ]
                },"patrocinadores": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"descricao": string | null,"edicao_id": number,"empresa_id": number | null,"id": number,"logo_path": string | null,"nivel": string | null,"nome": string,"ordem": number,"site": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"edicao_id": number,"empresa_id"?: number | null,"id"?: never,"logo_path"?: string | null,"nivel"?: string | null,"nome": string,"ordem"?: number,"site"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"edicao_id"?: number,"empresa_id"?: number | null,"id"?: never,"logo_path"?: string | null,"nivel"?: string | null,"nome"?: string,"ordem"?: number,"site"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "patrocinadores_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patrocinadores_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes_publicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "patrocinadores_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    }
                  ]
                },"pedidos_gdpr": {
                  Row: {
                    "atendido_por": string | null,"atualizado_em": string,"concluido_em": string | null,"criado_em": string,"email": string,"id": number,"observacao": string | null,"perfil_id": string | null,"prazo_em": string,"status": Database["public"]['Enums']["status_pedido"],"tipo": Database["public"]['Enums']["tipo_pedido_gdpr"]
                  }
                  Insert: {
                    "atendido_por"?: string | null,"atualizado_em"?: string,"concluido_em"?: string | null,"criado_em"?: string,"email": string,"id"?: never,"observacao"?: string | null,"perfil_id"?: string | null,"prazo_em": string,"status"?: Database["public"]['Enums']["status_pedido"],"tipo": Database["public"]['Enums']["tipo_pedido_gdpr"]
                  }
                  Update: {
                    "atendido_por"?: string | null,"atualizado_em"?: string,"concluido_em"?: string | null,"criado_em"?: string,"email"?: string,"id"?: never,"observacao"?: string | null,"perfil_id"?: string | null,"prazo_em"?: string,"status"?: Database["public"]['Enums']["status_pedido"],"tipo"?: Database["public"]['Enums']["tipo_pedido_gdpr"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "pedidos_gdpr_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pedidos_gdpr_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"perfis": {
                  Row: {
                    "atualizado_em": string,"bio": string | null,"cidade": string | null,"criado_em": string,"empresa_nome": string | null,"foto_path": string | null,"id": string,"instagram": string | null,"linkedin_url": string | null,"maior_18_em": string | null,"nome": string,"onboarding_em": string | null,"pais": string | null,"publico_aprovado_em": string | null,"setor_id": number | null,"slug": string | null,"suspenso_em": string | null,"visibilidade": Database["public"]['Enums']["visibilidade_perfil"]
                  }
                  Insert: {
                    "atualizado_em"?: string,"bio"?: string | null,"cidade"?: string | null,"criado_em"?: string,"empresa_nome"?: string | null,"foto_path"?: string | null,"id": string,"instagram"?: string | null,"linkedin_url"?: string | null,"maior_18_em"?: string | null,"nome": string,"onboarding_em"?: string | null,"pais"?: string | null,"publico_aprovado_em"?: string | null,"setor_id"?: number | null,"slug"?: string | null,"suspenso_em"?: string | null,"visibilidade"?: Database["public"]['Enums']["visibilidade_perfil"]
                  }
                  Update: {
                    "atualizado_em"?: string,"bio"?: string | null,"cidade"?: string | null,"criado_em"?: string,"empresa_nome"?: string | null,"foto_path"?: string | null,"id"?: string,"instagram"?: string | null,"linkedin_url"?: string | null,"maior_18_em"?: string | null,"nome"?: string,"onboarding_em"?: string | null,"pais"?: string | null,"publico_aprovado_em"?: string | null,"setor_id"?: number | null,"slug"?: string | null,"suspenso_em"?: string | null,"visibilidade"?: Database["public"]['Enums']["visibilidade_perfil"]
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
                },"perfis_contato": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"email_contato": string | null,"perfil_id": string,"whatsapp": string | null
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"email_contato"?: string | null,"perfil_id"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"email_contato"?: string | null,"perfil_id"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "perfis_contato_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: true
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "perfis_contato_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: true
      referencedRelation: "perfis_vitrine"
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
    },{
      foreignKeyName: "planos_vertical_id_fkey"
      columns: ["vertical_id"]
isOneToOne: false
      referencedRelation: "verticais"
      referencedColumns: ["id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "autor_id": string | null,"corpo": string,"criado_em": string,"editado_em": string | null,"espaco_id": number,"id": number,"oculto_em": string | null,"oculto_por": string | null
                  }
                  Insert: {
                    "autor_id"?: string | null,"corpo": string,"criado_em"?: string,"editado_em"?: string | null,"espaco_id": number,"id"?: never,"oculto_em"?: string | null,"oculto_por"?: string | null
                  }
                  Update: {
                    "autor_id"?: string | null,"corpo"?: string,"criado_em"?: string,"editado_em"?: string | null,"espaco_id"?: number,"id"?: never,"oculto_em"?: string | null,"oculto_por"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "posts_espaco_id_fkey"
      columns: ["espaco_id"]
isOneToOne: false
      referencedRelation: "espacos"
      referencedColumns: ["id"]
    }
                  ]
                },"premiados": {
                  Row: {
                    "alteracao_em": string | null,"alteracao_pendente": Json | null,"atualizado_em": string,"categoria_id": number,"consentimento_id": number | null,"convite_email": string | null,"criado_em": string,"edicao_id": number,"empresa_id": number | null,"foto_path": string | null,"historia": string | null,"id": number,"indicado_id": number | null,"materia_url": string | null,"nome": string,"perfil_id": string | null,"publicado_em": string | null,"redes": NonNullable<Json>,"slug": string,"video_entrevista_id": string | null,"video_premiacao_id": string | null
                  }
                  Insert: {
                    "alteracao_em"?: string | null,"alteracao_pendente"?: Json | null,"atualizado_em"?: string,"categoria_id": number,"consentimento_id"?: number | null,"convite_email"?: string | null,"criado_em"?: string,"edicao_id": number,"empresa_id"?: number | null,"foto_path"?: string | null,"historia"?: string | null,"id"?: never,"indicado_id"?: number | null,"materia_url"?: string | null,"nome": string,"perfil_id"?: string | null,"publicado_em"?: string | null,"redes"?: NonNullable<Json>,"slug": string,"video_entrevista_id"?: string | null,"video_premiacao_id"?: string | null
                  }
                  Update: {
                    "alteracao_em"?: string | null,"alteracao_pendente"?: Json | null,"atualizado_em"?: string,"categoria_id"?: number,"consentimento_id"?: number | null,"convite_email"?: string | null,"criado_em"?: string,"edicao_id"?: number,"empresa_id"?: number | null,"foto_path"?: string | null,"historia"?: string | null,"id"?: never,"indicado_id"?: number | null,"materia_url"?: string | null,"nome"?: string,"perfil_id"?: string | null,"publicado_em"?: string | null,"redes"?: NonNullable<Json>,"slug"?: string,"video_entrevista_id"?: string | null,"video_premiacao_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "premiados_categoria_id_edicao_id_fkey"
      columns: ["categoria_id","edicao_id"]
isOneToOne: false
      referencedRelation: "categorias_premio"
      referencedColumns: ["id","edicao_id"]
    },{
      foreignKeyName: "premiados_consentimento_id_fkey"
      columns: ["consentimento_id"]
isOneToOne: false
      referencedRelation: "consentimentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "premiados_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "premiados_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes_publicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "premiados_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "premiados_indicado_id_fkey"
      columns: ["indicado_id"]
isOneToOne: true
      referencedRelation: "indicados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "premiados_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "premiados_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"progresso_aula": {
                  Row: {
                    "atualizado_em": string,"aula_id": number,"concluida_em": string | null,"criado_em": string,"percentual": number,"perfil_id": string,"posicao_seg": number
                  }
                  Insert: {
                    "atualizado_em"?: string,"aula_id": number,"concluida_em"?: string | null,"criado_em"?: string,"percentual"?: number,"perfil_id": string,"posicao_seg"?: number
                  }
                  Update: {
                    "atualizado_em"?: string,"aula_id"?: number,"concluida_em"?: string | null,"criado_em"?: string,"percentual"?: number,"perfil_id"?: string,"posicao_seg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "progresso_aula_aula_id_fkey"
      columns: ["aula_id"]
isOneToOne: false
      referencedRelation: "aulas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "progresso_aula_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "progresso_aula_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"receitas_externas": {
                  Row: {
                    "anulado_em": string | null,"anulado_por": string | null,"atualizado_em": string,"bruto_centavos": number,"cliente_email": string | null,"cliente_nome": string,"comprovante_path": string,"criado_em": string,"descricao": string | null,"id": number,"lancado_por": string,"moeda": string,"motivo_anulacao": string | null,"origem": Database["public"]['Enums']["origem_receita_externa"],"perfil_id": string | null,"plano_id": number | null,"recebido_em": string,"tipo_receita": Database["public"]['Enums']["tipo_receita"],"vat_centavos": number
                  }
                  Insert: {
                    "anulado_em"?: string | null,"anulado_por"?: string | null,"atualizado_em"?: string,"bruto_centavos": number,"cliente_email"?: string | null,"cliente_nome": string,"comprovante_path": string,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"lancado_por": string,"moeda": string,"motivo_anulacao"?: string | null,"origem": Database["public"]['Enums']["origem_receita_externa"],"perfil_id"?: string | null,"plano_id"?: number | null,"recebido_em": string,"tipo_receita": Database["public"]['Enums']["tipo_receita"],"vat_centavos"?: number
                  }
                  Update: {
                    "anulado_em"?: string | null,"anulado_por"?: string | null,"atualizado_em"?: string,"bruto_centavos"?: number,"cliente_email"?: string | null,"cliente_nome"?: string,"comprovante_path"?: string,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"lancado_por"?: string,"moeda"?: string,"motivo_anulacao"?: string | null,"origem"?: Database["public"]['Enums']["origem_receita_externa"],"perfil_id"?: string | null,"plano_id"?: number | null,"recebido_em"?: string,"tipo_receita"?: Database["public"]['Enums']["tipo_receita"],"vat_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "receitas_externas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receitas_externas_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "receitas_externas_plano_id_fkey"
      columns: ["plano_id"]
isOneToOne: false
      referencedRelation: "planos"
      referencedColumns: ["id"]
    }
                  ]
                },"reembolsos": {
                  Row: {
                    "conta_stripe_id": number | null,"criado_em": string,"devolvido_em": string,"id": number,"lancado_por": string | null,"moeda": string,"pagamento_id": number | null,"receita_externa_id": number | null,"stripe_id": string | null,"tipo": Database["public"]['Enums']["tipo_estorno"],"valor_centavos": number,"vat_centavos": number
                  }
                  Insert: {
                    "conta_stripe_id"?: number | null,"criado_em"?: string,"devolvido_em": string,"id"?: never,"lancado_por"?: string | null,"moeda": string,"pagamento_id"?: number | null,"receita_externa_id"?: number | null,"stripe_id"?: string | null,"tipo": Database["public"]['Enums']["tipo_estorno"],"valor_centavos": number,"vat_centavos"?: number
                  }
                  Update: {
                    "conta_stripe_id"?: number | null,"criado_em"?: string,"devolvido_em"?: string,"id"?: never,"lancado_por"?: string | null,"moeda"?: string,"pagamento_id"?: number | null,"receita_externa_id"?: number | null,"stripe_id"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_estorno"],"valor_centavos"?: number,"vat_centavos"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reembolsos_conta_stripe_id_fkey"
      columns: ["conta_stripe_id"]
isOneToOne: false
      referencedRelation: "contas_stripe"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_pagamento_id_fkey"
      columns: ["pagamento_id"]
isOneToOne: false
      referencedRelation: "pagamentos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reembolsos_receita_externa_id_fkey"
      columns: ["receita_externa_id"]
isOneToOne: false
      referencedRelation: "receitas_externas"
      referencedColumns: ["id"]
    }
                  ]
                },"relatorios_ciclo": {
                  Row: {
                    "ciclo_fim": string,"ciclo_inicio": string,"criado_em": string,"csv_sha256": string,"dados": NonNullable<Json>,"enviado_em": string | null,"gerado_por": string,"motivo_reabertura": string | null,"motivo_reemissao": string | null,"reaberto_em": string | null,"reaberto_por": string | null,"versao": number
                  }
                  Insert: {
                    "ciclo_fim": string,"ciclo_inicio": string,"criado_em"?: string,"csv_sha256": string,"dados": NonNullable<Json>,"enviado_em"?: string | null,"gerado_por": string,"motivo_reabertura"?: string | null,"motivo_reemissao"?: string | null,"reaberto_em"?: string | null,"reaberto_por"?: string | null,"versao": number
                  }
                  Update: {
                    "ciclo_fim"?: string,"ciclo_inicio"?: string,"criado_em"?: string,"csv_sha256"?: string,"dados"?: NonNullable<Json>,"enviado_em"?: string | null,"gerado_por"?: string,"motivo_reabertura"?: string | null,"motivo_reemissao"?: string | null,"reaberto_em"?: string | null,"reaberto_por"?: string | null,"versao"?: number
                  }
                  Relationships: [
                    
                  ]
                },"salvos": {
                  Row: {
                    "aula_id": number | null,"criado_em": string,"id": number,"perfil_id": string,"video_id": number | null
                  }
                  Insert: {
                    "aula_id"?: number | null,"criado_em"?: string,"id"?: never,"perfil_id"?: string,"video_id"?: number | null
                  }
                  Update: {
                    "aula_id"?: number | null,"criado_em"?: string,"id"?: never,"perfil_id"?: string,"video_id"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "salvos_aula_id_fkey"
      columns: ["aula_id"]
isOneToOne: false
      referencedRelation: "aulas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salvos_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salvos_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "salvos_video_id_fkey"
      columns: ["video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["id"]
    }
                  ]
                },"setores": {
                  Row: {
                    "ativo": boolean,"atualizado_em": string,"criado_em": string,"id": number,"nome": string,"nome_en": string | null,"ordem": number,"slug": string
                  }
                  Insert: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome": string,"nome_en"?: string | null,"ordem"?: number,"slug": string
                  }
                  Update: {
                    "ativo"?: boolean,"atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome"?: string,"nome_en"?: string | null,"ordem"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sugestoes_match": {
                  Row: {
                    "criado_em": string,"id": number,"motivo": string,"motivo_dados": Json | null,"perfil_id": string,"pontuacao": number,"semana": string,"sugerido_id": string
                  }
                  Insert: {
                    "criado_em"?: string,"id"?: never,"motivo": string,"motivo_dados"?: Json | null,"perfil_id": string,"pontuacao": number,"semana": string,"sugerido_id": string
                  }
                  Update: {
                    "criado_em"?: string,"id"?: never,"motivo"?: string,"motivo_dados"?: Json | null,"perfil_id"?: string,"pontuacao"?: number,"semana"?: string,"sugerido_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sugestoes_match_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sugestoes_match_perfil_id_fkey"
      columns: ["perfil_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sugestoes_match_sugerido_id_fkey"
      columns: ["sugerido_id"]
isOneToOne: false
      referencedRelation: "perfis"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sugestoes_match_sugerido_id_fkey"
      columns: ["sugerido_id"]
isOneToOne: false
      referencedRelation: "perfis_vitrine"
      referencedColumns: ["id"]
    }
                  ]
                },"temas": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"id": number,"nome": string,"nome_en": string | null,"ordem": number,"slug": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome": string,"nome_en"?: string | null,"ordem"?: number,"slug": string
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"id"?: never,"nome"?: string,"nome_en"?: string | null,"ordem"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"transmissoes": {
                  Row: {
                    "abre_min_antes": number,"atualizado_em": string,"aula_id": number,"criado_em": string,"url": string,"url_reserva": string | null,"usar_reserva": boolean
                  }
                  Insert: {
                    "abre_min_antes"?: number,"atualizado_em"?: string,"aula_id": number,"criado_em"?: string,"url": string,"url_reserva"?: string | null,"usar_reserva"?: boolean
                  }
                  Update: {
                    "abre_min_antes"?: number,"atualizado_em"?: string,"aula_id"?: number,"criado_em"?: string,"url"?: string,"url_reserva"?: string | null,"usar_reserva"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "transmissoes_aula_id_fkey"
      columns: ["aula_id"]
isOneToOne: true
      referencedRelation: "aulas"
      referencedColumns: ["id"]
    }
                  ]
                },"verticais": {
                  Row: {
                    "aceita_entregas": boolean,"ativa": boolean,"atualizado_em": string,"conta_como_ia": boolean,"criado_em": string,"descricao": string | null,"id": number,"nome": string,"nome_en": string | null,"ordem": number,"slug": string
                  }
                  Insert: {
                    "aceita_entregas"?: boolean,"ativa"?: boolean,"atualizado_em"?: string,"conta_como_ia"?: boolean,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"nome": string,"nome_en"?: string | null,"ordem"?: number,"slug": string
                  }
                  Update: {
                    "aceita_entregas"?: boolean,"ativa"?: boolean,"atualizado_em"?: string,"conta_como_ia"?: boolean,"criado_em"?: string,"descricao"?: string | null,"id"?: never,"nome"?: string,"nome_en"?: string | null,"ordem"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"videos": {
                  Row: {
                    "atualizado_em": string,"criado_em": string,"descricao": string | null,"duracao_min": number | null,"edicao_id": number | null,"id": number,"nivel_minimo": Database["public"]['Enums']["nivel_acesso"],"publicado_em": string | null,"slug": string,"tema_id": number | null,"tipo": Database["public"]['Enums']["tipo_video"],"titulo": string,"trailer_video_id": string | null,"video_id": string
                  }
                  Insert: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"duracao_min"?: number | null,"edicao_id"?: number | null,"id"?: never,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"publicado_em"?: string | null,"slug": string,"tema_id"?: number | null,"tipo": Database["public"]['Enums']["tipo_video"],"titulo": string,"trailer_video_id"?: string | null,"video_id": string
                  }
                  Update: {
                    "atualizado_em"?: string,"criado_em"?: string,"descricao"?: string | null,"duracao_min"?: number | null,"edicao_id"?: number | null,"id"?: never,"nivel_minimo"?: Database["public"]['Enums']["nivel_acesso"],"publicado_em"?: string | null,"slug"?: string,"tema_id"?: number | null,"tipo"?: Database["public"]['Enums']["tipo_video"],"titulo"?: string,"trailer_video_id"?: string | null,"video_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "videos_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "videos_edicao_id_fkey"
      columns: ["edicao_id"]
isOneToOne: false
      referencedRelation: "edicoes_publicas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "videos_tema_id_fkey"
      columns: ["tema_id"]
isOneToOne: false
      referencedRelation: "temas"
      referencedColumns: ["id"]
    }
                  ]
                },"videos_citados": {
                  Row: {
                    "criado_em": string,"empresa_id": number | null,"id": number,"premiado_id": number | null,"video_id": number
                  }
                  Insert: {
                    "criado_em"?: string,"empresa_id"?: number | null,"id"?: never,"premiado_id"?: number | null,"video_id": number
                  }
                  Update: {
                    "criado_em"?: string,"empresa_id"?: number | null,"id"?: never,"premiado_id"?: number | null,"video_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "videos_citados_empresa_id_fkey"
      columns: ["empresa_id"]
isOneToOne: false
      referencedRelation: "empresas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "videos_citados_premiado_id_fkey"
      columns: ["premiado_id"]
isOneToOne: false
      referencedRelation: "premiados"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "videos_citados_video_id_fkey"
      columns: ["video_id"]
isOneToOne: false
      referencedRelation: "videos"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "edicoes_publicas": {
                  Row: {
                    "ano": number | null,"cidade": string | null,"descricao": string | null,"durante_fim": string | null,"durante_inicio": string | null,"fase": string | null,"id": number | null,"nome": string | null,"pais": string | null,"publicada_em": string | null,"slug": string | null
                  }
                  Insert: {
                           "ano"?: number | null,"cidade"?: string | null,"descricao"?: string | null,"durante_fim"?: string | null,"durante_inicio"?: string | null,"fase"?: never,"id"?: number | null,"nome"?: string | null,"pais"?: string | null,"publicada_em"?: string | null,"slug"?: string | null
                         }
                        Update: {
                           "ano"?: number | null,"cidade"?: string | null,"descricao"?: string | null,"durante_fim"?: string | null,"durante_inicio"?: string | null,"fase"?: never,"id"?: number | null,"nome"?: string | null,"pais"?: string | null,"publicada_em"?: string | null,"slug"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"perfis_vitrine": {
                  Row: {
                    "bio": string | null,"cidade": string | null,"empresa_nome": string | null,"foto_path": string | null,"id": string | null,"instagram": string | null,"linkedin_url": string | null,"nome": string | null,"pais": string | null,"setor_id": number | null,"slug": string | null
                  }
                  Insert: {
                           "bio"?: string | null,"cidade"?: string | null,"empresa_nome"?: string | null,"foto_path"?: string | null,"id"?: string | null,"instagram"?: string | null,"linkedin_url"?: string | null,"nome"?: string | null,"pais"?: string | null,"setor_id"?: number | null,"slug"?: string | null
                         }
                        Update: {
                           "bio"?: string | null,"cidade"?: string | null,"empresa_nome"?: string | null,"foto_path"?: string | null,"id"?: string | null,"instagram"?: string | null,"linkedin_url"?: string | null,"nome"?: string | null,"pais"?: string | null,"setor_id"?: number | null,"slug"?: string | null
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
                }
          }
          Functions: {
            "abertura_transmissao":
{ Args: { "aula": number }; Returns: string
                           },
"aprovar_alteracao_premiado":
{ Args: { "aprovar": boolean,"premiado": number }; Returns: undefined
                           },
"aprovar_empresa":
{ Args: { "aprovar": boolean,"empresa": number,"motivo"?: string }; Returns: undefined
                           },
"aprovar_material":
{ Args: { "material": number }; Returns: undefined
                           },
"aprovar_perfil_publico":
{ Args: { "aprovar"?: boolean,"perfil": string,"versao": string }; Returns: undefined
                           },
"arquivos_do_titular":
{ Args: { "p_uid": string }; Returns: {
              "bucket": string,"nome": string
            }[]
                           },
"buscar_membros":
{ Args: { "filtro_categoria"?: number,"filtro_cidade"?: string,"filtro_setor"?: number,"filtro_tipo"?: Database["public"]['Enums']["tipo_network"],"limite"?: number,"pular"?: number }; Returns: {
              "bio": string,"cidade": string,"empresa_nome": string,"foto_path": string,"id": string,"instagram": string,"linkedin_url": string,"nome": string,"pais": string,"setor_id": number,"slug": string
            }[]
                           },
"ciclo_de":
{ Args: { "t": string }; Returns: unknown
                           },
"classificar_item_pagamento":
{ Args: { "item": number,"plano": number }; Returns: undefined
                           },
"clientes_ativos":
{ Args: { "ciclo_inicio": string }; Returns: {
              "cliente_chave": string,"origem": string
            }[]
                           },
"conceder_acesso_manual":
{ Args: { "ate": string,"perfil": string,"plano": number,"receita": number }; Returns: number
                           },
"consumir_limite":
{ Args: { "p_acao": string }; Returns: boolean
                           },
"corrigir_entrega":
{ Args: { "devolutiva": string,"entrega": number,"novo_status": Database["public"]['Enums']["status_entrega"] }; Returns: undefined
                           },
"declarar_maior_18":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"email_cadastro_pendente":
{ Args: { "p_email": string }; Returns: string
                           },
"email_do_membro":
{ Args: { "perfil": string }; Returns: string
                           },
"empresas_equipe":
{ Args: Record<PropertyKey, never>; Returns: {
              "aprovada_em": string | null,
"aprovada_por": string | null,
"atualizado_em": string,
"cidade": string | null,
"criado_em": string,
"descricao": string | null,
"dono_perfil_id": string | null,
"id": number,
"logo_path": string | null,
"motivo_recusa": string | null,
"nome": string,
"pais": string | null,
"setor_id": number,
"site": string | null,
"slug": string,
"status": Database["public"]['Enums']["status_moderacao"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "empresas"
        isOneToOne: false
        isSetofReturn: true
      } },
"excluir_conta_sem_declaracao":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"exportar_meus_dados":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fase":
{ Args: { "e": Database["public"]['Tables']["edicoes"]['Row'] }; Returns: string
                           },
"fase_edicao":
{ Args: { "fim": string,"inicio": string }; Returns: string
                           },
"fechar_ciclo":
{ Args: { "ciclo_inicio": string }; Returns: {
              "ciclo_fim": string,
"ciclo_inicio": string,
"criado_em": string,
"csv_sha256": string,
"dados": NonNullable<Json>,
"enviado_em": string | null,
"gerado_por": string,
"motivo_reabertura": string | null,
"motivo_reemissao": string | null,
"reaberto_em": string | null,
"reaberto_por": string | null,
"versao": number
            }
                          SetofOptions: {
        from: "*"
        to: "relatorios_ciclo"
        isOneToOne: true
        isSetofReturn: false
      } },
"idade_declarada":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"link_transmissao":
{ Args: { "aula": number }; Returns: string
                           },
"marcar_relatorio_enviado":
{ Args: { "ciclo_inicio": string,"versao": number }; Returns: undefined
                           },
"minhas_empresas":
{ Args: Record<PropertyKey, never>; Returns: {
              "aprovada_em": string | null,
"aprovada_por": string | null,
"atualizado_em": string,
"cidade": string | null,
"criado_em": string,
"descricao": string | null,
"dono_perfil_id": string | null,
"id": number,
"logo_path": string | null,
"motivo_recusa": string | null,
"nome": string,
"pais": string | null,
"setor_id": number,
"site": string | null,
"slug": string,
"status": Database["public"]['Enums']["status_moderacao"]
            }[]
                          SetofOptions: {
        from: "*"
        to: "empresas"
        isOneToOne: false
        isSetofReturn: true
      } },
"moderar_conteudo":
{ Args: { "alvo": string,"alvo_id": number,"ocultar": boolean }; Returns: undefined
                           },
"pedir_alteracao_premiado":
{ Args: { "campos": Json,"premiado": number }; Returns: undefined
                           },
"pode_ver_conteudo":
{ Args: { "minimo": Database["public"]['Enums']["nivel_acesso"] }; Returns: boolean
                           },
"premiado_privado":
{ Args: { "premiado": number }; Returns: Json
                           },
"processar_evento_stripe":
{ Args: { "p_conta_stripe_id": number,"p_evento": Json }; Returns: string
                           },
"reabrir_ciclo":
{ Args: { "ciclo_inicio": string,"motivo": string }; Returns: undefined
                           },
"registrar_aceite_checkout":
{ Args: { "p_plano_id": number,"p_versao": string }; Returns: number
                           },
"relatorio_ciclo":
{ Args: { "ciclo_inicio": string }; Returns: Json
                           },
"resolver_denuncia":
{ Args: { "denuncia": number,"procedente": boolean }; Returns: undefined
                           },
"revelar_contato":
{ Args: { "outro": string }; Returns: {
              "email_contato": string,"whatsapp": string
            }[]
                           },
"suspender_perfil":
{ Args: { "perfil": string,"suspender": boolean }; Returns: undefined
                           },
"tem_acesso":
{ Args: { "minimo": Database["public"]['Enums']["nivel_acesso"] }; Returns: boolean
                           },
"video_da_aula":
{ Args: { "p_aula": number }; Returns: string
                           },
"video_do_video":
{ Args: { "p_video": number }; Returns: string
                           }
          }
          Enums: {
            "nivel_acesso": "visitante"|"clube"|"grupo","origem_assinatura": "stripe"|"manual","origem_conexao": "busca"|"match","origem_receita_externa": "ingresso"|"pix"|"transferencia"|"evento"|"outro","papel_equipe": "super_admin"|"editor"|"corretor"|"moderador"|"auditor","status_assinatura": "incomplete"|"incomplete_expired"|"trialing"|"active"|"past_due"|"canceled"|"unpaid"|"paused","status_conexao": "pendente"|"aceita"|"recusada"|"cancelada","status_denuncia": "aberta"|"procedente"|"improcedente","status_entrega": "enviada"|"aprovada"|"ajustar","status_material": "rascunho"|"aprovado","status_moderacao": "pendente"|"publicada"|"rejeitada","status_pedido": "recebido"|"em_andamento"|"concluido"|"recusado","tipo_aula": "gravada"|"ao_vivo","tipo_documento": "termos"|"privacidade"|"cookies"|"reembolso"|"arrependimento"|"marketing"|"match"|"hall_of_fame","tipo_estorno": "reembolso"|"chargeback","tipo_material": "resumo"|"ebook"|"exercicios","tipo_network": "procura"|"oferece","tipo_notificacao": "conexao_recebida"|"conexao_aceita"|"aula_publicada"|"sistema","tipo_pedido_gdpr": "exportacao"|"exclusao"|"retificacao","tipo_receita": "assinatura"|"curso"|"produto_digital"|"ingresso","tipo_video": "talk"|"original"|"cerimonia","visibilidade_perfil": "membros"|"publico"
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
            "nivel_acesso": ["visitante", "clube", "grupo"],"origem_assinatura": ["stripe", "manual"],"origem_conexao": ["busca", "match"],"origem_receita_externa": ["ingresso", "pix", "transferencia", "evento", "outro"],"papel_equipe": ["super_admin", "editor", "corretor", "moderador", "auditor"],"status_assinatura": ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"],"status_conexao": ["pendente", "aceita", "recusada", "cancelada"],"status_denuncia": ["aberta", "procedente", "improcedente"],"status_entrega": ["enviada", "aprovada", "ajustar"],"status_material": ["rascunho", "aprovado"],"status_moderacao": ["pendente", "publicada", "rejeitada"],"status_pedido": ["recebido", "em_andamento", "concluido", "recusado"],"tipo_aula": ["gravada", "ao_vivo"],"tipo_documento": ["termos", "privacidade", "cookies", "reembolso", "arrependimento", "marketing", "match", "hall_of_fame"],"tipo_estorno": ["reembolso", "chargeback"],"tipo_material": ["resumo", "ebook", "exercicios"],"tipo_network": ["procura", "oferece"],"tipo_notificacao": ["conexao_recebida", "conexao_aceita", "aula_publicada", "sistema"],"tipo_pedido_gdpr": ["exportacao", "exclusao", "retificacao"],"tipo_receita": ["assinatura", "curso", "produto_digital", "ingresso"],"tipo_video": ["talk", "original", "cerimonia"],"visibilidade_perfil": ["membros", "publico"]
          }
        }
} as const

