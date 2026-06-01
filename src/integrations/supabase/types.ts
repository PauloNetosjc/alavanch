export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_config: {
        Row: {
          ativo: boolean
          created_at: string
          dias_semana: number[]
          duracao_padrao_min: number
          hora_fim: string
          hora_inicio: string
          id: string
          loja_id: string | null
          prazo_minimo_dias_uteis: number
          tipo: Database["public"]["Enums"]["agenda_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          duracao_padrao_min?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          loja_id?: string | null
          prazo_minimo_dias_uteis?: number
          tipo: Database["public"]["Enums"]["agenda_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dias_semana?: number[]
          duracao_padrao_min?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          loja_id?: string | null
          prazo_minimo_dias_uteis?: number
          tipo?: Database["public"]["Enums"]["agenda_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      agenda_eventos: {
        Row: {
          cancelado_em: string | null
          cliente_id: string | null
          concluido_em: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string | null
          endereco: string | null
          excecao: boolean
          excecao_autorizador_id: string | null
          excecao_motivo: string | null
          hora_fim: string | null
          hora_inicio: string
          id: string
          loja_id: string | null
          orcamento_id: string | null
          pedido_id: string | null
          responsavel_id: string
          status: Database["public"]["Enums"]["agenda_status"]
          tipo: Database["public"]["Enums"]["agenda_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          cancelado_em?: string | null
          cliente_id?: string | null
          concluido_em?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          descricao?: string | null
          endereco?: string | null
          excecao?: boolean
          excecao_autorizador_id?: string | null
          excecao_motivo?: string | null
          hora_fim?: string | null
          hora_inicio: string
          id?: string
          loja_id?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          responsavel_id: string
          status?: Database["public"]["Enums"]["agenda_status"]
          tipo: Database["public"]["Enums"]["agenda_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          cancelado_em?: string | null
          cliente_id?: string | null
          concluido_em?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string | null
          endereco?: string | null
          excecao?: boolean
          excecao_autorizador_id?: string | null
          excecao_motivo?: string | null
          hora_fim?: string | null
          hora_inicio?: string
          id?: string
          loja_id?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
          responsavel_id?: string
          status?: Database["public"]["Enums"]["agenda_status"]
          tipo?: Database["public"]["Enums"]["agenda_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_eventos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_excecao_autorizadores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          loja_id: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          loja_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agenda_feriados: {
        Row: {
          created_at: string
          data: string
          descricao: string
          id: string
          loja_id: string | null
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
          id?: string
          loja_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          loja_id?: string | null
        }
        Relationships: []
      }
      ambientes: {
        Row: {
          aplicar_desconto: boolean
          created_at: string
          custo_aquisicao: number | null
          custo_fabrica: number | null
          custo_loja: number | null
          descricao: string | null
          id: string
          markup: number | null
          negociavel: boolean
          nome: string
          orcamento_id: string
          ordem: number | null
          prazo_dias: number | null
          preco_sugerido: number | null
        }
        Insert: {
          aplicar_desconto?: boolean
          created_at?: string
          custo_aquisicao?: number | null
          custo_fabrica?: number | null
          custo_loja?: number | null
          descricao?: string | null
          id?: string
          markup?: number | null
          negociavel?: boolean
          nome: string
          orcamento_id: string
          ordem?: number | null
          prazo_dias?: number | null
          preco_sugerido?: number | null
        }
        Update: {
          aplicar_desconto?: boolean
          created_at?: string
          custo_aquisicao?: number | null
          custo_fabrica?: number | null
          custo_loja?: number | null
          descricao?: string | null
          id?: string
          markup?: number | null
          negociavel?: boolean
          nome?: string
          orcamento_id?: string
          ordem?: number | null
          prazo_dias?: number | null
          preco_sugerido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ambientes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      anexos_assistencia: {
        Row: {
          assistencia_id: string
          checkin_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          nome: string
          storage_path: string | null
          tamanho: number | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          assistencia_id: string
          checkin_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome: string
          storage_path?: string | null
          tamanho?: number | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          assistencia_id?: string
          checkin_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome?: string
          storage_path?: string | null
          tamanho?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "anexos_assistencia_assistencia_id_fkey"
            columns: ["assistencia_id"]
            isOneToOne: false
            referencedRelation: "assistencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anexos_assistencia_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovacoes_desconto: {
        Row: {
          aprovador_email: string | null
          aprovador_id: string | null
          created_at: string
          desconto_perc: number
          desconto_valor: number
          id: string
          limite_solicitante: number | null
          observacao: string | null
          orcamento_id: string
          pedido_id: string | null
          solicitante_id: string | null
        }
        Insert: {
          aprovador_email?: string | null
          aprovador_id?: string | null
          created_at?: string
          desconto_perc: number
          desconto_valor: number
          id?: string
          limite_solicitante?: number | null
          observacao?: string | null
          orcamento_id: string
          pedido_id?: string | null
          solicitante_id?: string | null
        }
        Update: {
          aprovador_email?: string | null
          aprovador_id?: string | null
          created_at?: string
          desconto_perc?: number
          desconto_valor?: number
          id?: string
          limite_solicitante?: number | null
          observacao?: string | null
          orcamento_id?: string
          pedido_id?: string | null
          solicitante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aprovacoes_desconto_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprovacoes_desconto_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      aprovadores_financeiros: {
        Row: {
          aprova_pagar: boolean
          aprova_receber: boolean
          created_at: string
          id: string
          loja_id: string | null
          user_id: string
        }
        Insert: {
          aprova_pagar?: boolean
          aprova_receber?: boolean
          created_at?: string
          id?: string
          loja_id?: string | null
          user_id: string
        }
        Update: {
          aprova_pagar?: boolean
          aprova_receber?: boolean
          created_at?: string
          id?: string
          loja_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprovadores_financeiros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_eventos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          ip: string | null
          participante_id: string | null
          solicitacao_id: string
          status_anterior: string | null
          status_novo: string | null
          tipo_evento: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          ip?: string | null
          participante_id?: string | null
          solicitacao_id: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          ip?: string | null
          participante_id?: string | null
          solicitacao_id?: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_eventos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_evidencias: {
        Row: {
          aceite: boolean
          aceite_texto: string | null
          assinado_em: string
          assinatura_url: string | null
          created_at: string
          documento_foto_url: string | null
          id: string
          ip: string | null
          localizacao: Json | null
          manual: boolean
          participante_id: string | null
          selfie_url: string | null
          solicitacao_id: string
          tipo: string | null
          user_agent: string | null
        }
        Insert: {
          aceite?: boolean
          aceite_texto?: string | null
          assinado_em?: string
          assinatura_url?: string | null
          created_at?: string
          documento_foto_url?: string | null
          id?: string
          ip?: string | null
          localizacao?: Json | null
          manual?: boolean
          participante_id?: string | null
          selfie_url?: string | null
          solicitacao_id: string
          tipo?: string | null
          user_agent?: string | null
        }
        Update: {
          aceite?: boolean
          aceite_texto?: string | null
          assinado_em?: string
          assinatura_url?: string | null
          created_at?: string
          documento_foto_url?: string | null
          id?: string
          ip?: string | null
          localizacao?: Json | null
          manual?: boolean
          participante_id?: string | null
          selfie_url?: string | null
          solicitacao_id?: string
          tipo?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_evidencias_participante_id_fkey"
            columns: ["participante_id"]
            isOneToOne: false
            referencedRelation: "assinatura_participantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinatura_evidencias_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_participantes: {
        Row: {
          assinado_em: string | null
          cargo: string | null
          created_at: string
          documento: string | null
          email: string | null
          enviado_em: string | null
          id: string
          ip: string | null
          nome: string | null
          solicitacao_id: string
          status: string
          telefone: string | null
          tipo: Database["public"]["Enums"]["assinatura_participante_tipo"]
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
          visualizado_em: string | null
        }
        Insert: {
          assinado_em?: string | null
          cargo?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          enviado_em?: string | null
          id?: string
          ip?: string | null
          nome?: string | null
          solicitacao_id: string
          status?: string
          telefone?: string | null
          tipo: Database["public"]["Enums"]["assinatura_participante_tipo"]
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          visualizado_em?: string | null
        }
        Update: {
          assinado_em?: string | null
          cargo?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          enviado_em?: string | null
          id?: string
          ip?: string | null
          nome?: string | null
          solicitacao_id?: string
          status?: string
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["assinatura_participante_tipo"]
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_participantes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          assinatura_base64: string
          assistencia_id: string
          created_at: string
          id: string
        }
        Insert: {
          assinatura_base64: string
          assistencia_id: string
          created_at?: string
          id?: string
        }
        Update: {
          assinatura_base64?: string
          assistencia_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_assistencia_id_fkey"
            columns: ["assistencia_id"]
            isOneToOne: false
            referencedRelation: "assistencias"
            referencedColumns: ["id"]
          },
        ]
      }
      assistencia_checklist: {
        Row: {
          assistencia_id: string
          concluido: boolean | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          descricao: string
          id: string
          obrigatorio: boolean | null
          ordem: number | null
          template_item_id: string | null
        }
        Insert: {
          assistencia_id: string
          concluido?: boolean | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          template_item_id?: string | null
        }
        Update: {
          assistencia_id?: string
          concluido?: boolean | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          descricao?: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          template_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistencia_checklist_assistencia_id_fkey"
            columns: ["assistencia_id"]
            isOneToOne: false
            referencedRelation: "assistencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistencia_checklist_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      assistencias: {
        Row: {
          arquivada: boolean
          cliente_id: string | null
          codigo: string | null
          concluida_em: string | null
          created_at: string
          data_agendamento: string | null
          data_limite: string | null
          descricao: string | null
          hora_agendamento: string | null
          id: string
          loja_id: string | null
          material_necessario: boolean | null
          motivo_nao_conclusao: string | null
          observacoes: string | null
          pedido_id: string | null
          prioridade: string | null
          status: string | null
          tecnico_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          cliente_id?: string | null
          codigo?: string | null
          concluida_em?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_limite?: string | null
          descricao?: string | null
          hora_agendamento?: string | null
          id?: string
          loja_id?: string | null
          material_necessario?: boolean | null
          motivo_nao_conclusao?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          prioridade?: string | null
          status?: string | null
          tecnico_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          cliente_id?: string | null
          codigo?: string | null
          concluida_em?: string | null
          created_at?: string
          data_agendamento?: string | null
          data_limite?: string | null
          descricao?: string | null
          hora_agendamento?: string | null
          id?: string
          loja_id?: string | null
          material_necessario?: boolean | null
          motivo_nao_conclusao?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          prioridade?: string | null
          status?: string | null
          tecnico_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistencias_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistencias_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_transferencias_usuario: {
        Row: {
          contadores: Json
          created_at: string
          executado_por: string | null
          id: string
          motivo: string
          usuario_antigo: string
          usuario_novo: string
        }
        Insert: {
          contadores?: Json
          created_at?: string
          executado_por?: string | null
          id?: string
          motivo: string
          usuario_antigo: string
          usuario_novo: string
        }
        Update: {
          contadores?: Json
          created_at?: string
          executado_por?: string | null
          id?: string
          motivo?: string
          usuario_antigo?: string
          usuario_novo?: string
        }
        Relationships: []
      }
      autorizacoes: {
        Row: {
          agenda_evento_id: string | null
          aprovador_email: string | null
          aprovador_id: string | null
          categoria: Database["public"]["Enums"]["categoria_autorizacao"] | null
          cliente_id: string | null
          contexto: Json
          created_at: string
          decidido_em: string | null
          decisao_observacao: string | null
          descricao: string | null
          id: string
          limite_padrao: number | null
          loja_id: string | null
          motivo_rejeicao: string | null
          motivo_solicitacao: string | null
          orcamento_id: string | null
          origem_id: string | null
          origem_modulo: string | null
          pedido_id: string | null
          prioridade: string | null
          solicitante_email: string | null
          solicitante_id: string | null
          status: Database["public"]["Enums"]["autorizacao_status"]
          tipo: Database["public"]["Enums"]["autorizacao_tipo"]
          titulo: string
          updated_at: string
          valor_solicitado: number | null
        }
        Insert: {
          agenda_evento_id?: string | null
          aprovador_email?: string | null
          aprovador_id?: string | null
          categoria?:
            | Database["public"]["Enums"]["categoria_autorizacao"]
            | null
          cliente_id?: string | null
          contexto?: Json
          created_at?: string
          decidido_em?: string | null
          decisao_observacao?: string | null
          descricao?: string | null
          id?: string
          limite_padrao?: number | null
          loja_id?: string | null
          motivo_rejeicao?: string | null
          motivo_solicitacao?: string | null
          orcamento_id?: string | null
          origem_id?: string | null
          origem_modulo?: string | null
          pedido_id?: string | null
          prioridade?: string | null
          solicitante_email?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["autorizacao_status"]
          tipo: Database["public"]["Enums"]["autorizacao_tipo"]
          titulo: string
          updated_at?: string
          valor_solicitado?: number | null
        }
        Update: {
          agenda_evento_id?: string | null
          aprovador_email?: string | null
          aprovador_id?: string | null
          categoria?:
            | Database["public"]["Enums"]["categoria_autorizacao"]
            | null
          cliente_id?: string | null
          contexto?: Json
          created_at?: string
          decidido_em?: string | null
          decisao_observacao?: string | null
          descricao?: string | null
          id?: string
          limite_padrao?: number | null
          loja_id?: string | null
          motivo_rejeicao?: string | null
          motivo_solicitacao?: string | null
          orcamento_id?: string | null
          origem_id?: string | null
          origem_modulo?: string | null
          pedido_id?: string | null
          prioridade?: string | null
          solicitante_email?: string | null
          solicitante_id?: string | null
          status?: Database["public"]["Enums"]["autorizacao_status"]
          tipo?: Database["public"]["Enums"]["autorizacao_tipo"]
          titulo?: string
          updated_at?: string
          valor_solicitado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "autorizacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autorizacoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      base_assinaturas: {
        Row: {
          armazenamento_adicional_mb: number
          armazenamento_incluido_mb: number
          armazenamento_usado_mb: number
          atualizado_por: string | null
          base_cliente_id: string
          created_at: string
          criado_por: string | null
          data_cancelamento: string | null
          data_inicio: string | null
          dia_vencimento: number
          forma_pagamento: string | null
          id: string
          implantacao_paga: boolean
          lojas_incluidas: number
          observacoes: string | null
          plano: string
          status_assinatura: string
          updated_at: string
          usuarios_incluidos: number
          valor_implantacao: number
          valor_loja_adicional: number
          valor_mensal: number
          valor_por_gb_adicional: number
          valor_usuario_adicional: number
        }
        Insert: {
          armazenamento_adicional_mb?: number
          armazenamento_incluido_mb?: number
          armazenamento_usado_mb?: number
          atualizado_por?: string | null
          base_cliente_id: string
          created_at?: string
          criado_por?: string | null
          data_cancelamento?: string | null
          data_inicio?: string | null
          dia_vencimento?: number
          forma_pagamento?: string | null
          id?: string
          implantacao_paga?: boolean
          lojas_incluidas?: number
          observacoes?: string | null
          plano?: string
          status_assinatura?: string
          updated_at?: string
          usuarios_incluidos?: number
          valor_implantacao?: number
          valor_loja_adicional?: number
          valor_mensal?: number
          valor_por_gb_adicional?: number
          valor_usuario_adicional?: number
        }
        Update: {
          armazenamento_adicional_mb?: number
          armazenamento_incluido_mb?: number
          armazenamento_usado_mb?: number
          atualizado_por?: string | null
          base_cliente_id?: string
          created_at?: string
          criado_por?: string | null
          data_cancelamento?: string | null
          data_inicio?: string | null
          dia_vencimento?: number
          forma_pagamento?: string | null
          id?: string
          implantacao_paga?: boolean
          lojas_incluidas?: number
          observacoes?: string | null
          plano?: string
          status_assinatura?: string
          updated_at?: string
          usuarios_incluidos?: number
          valor_implantacao?: number
          valor_loja_adicional?: number
          valor_mensal?: number
          valor_por_gb_adicional?: number
          valor_usuario_adicional?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_assinaturas_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      base_cobrancas: {
        Row: {
          assinatura_id: string | null
          atualizado_por: string | null
          base_cliente_id: string
          competencia_ano: number | null
          competencia_mes: number | null
          contrato_id: string | null
          created_at: string
          criado_por: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          status: string
          tipo_cobranca: string
          updated_at: string
          valor: number
        }
        Insert: {
          assinatura_id?: string | null
          atualizado_por?: string | null
          base_cliente_id: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tipo_cobranca: string
          updated_at?: string
          valor?: number
        }
        Update: {
          assinatura_id?: string | null
          atualizado_por?: string | null
          base_cliente_id?: string
          competencia_ano?: number | null
          competencia_mes?: number | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          tipo_cobranca?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_cobrancas_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "base_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_cobrancas_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "base_contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      base_compras_avulsas: {
        Row: {
          atualizado_por: string | null
          base_cliente_id: string
          created_at: string
          criado_por: string | null
          data_compra: string
          descricao: string | null
          id: string
          observacoes: string | null
          quantidade_armazenamento_mb: number | null
          status_pagamento: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          atualizado_por?: string | null
          base_cliente_id: string
          created_at?: string
          criado_por?: string | null
          data_compra?: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          quantidade_armazenamento_mb?: number | null
          status_pagamento?: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          atualizado_por?: string | null
          base_cliente_id?: string
          created_at?: string
          criado_por?: string | null
          data_compra?: string
          descricao?: string | null
          id?: string
          observacoes?: string | null
          quantidade_armazenamento_mb?: number | null
          status_pagamento?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_compras_avulsas_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      base_contratos: {
        Row: {
          armazenamento_adicional_mb: number | null
          armazenamento_incluido_mb: number | null
          arquivo_assinado_url: string | null
          assinante_documento: string | null
          assinante_email: string | null
          assinante_ip: string | null
          assinante_nome: string | null
          assinante_user_agent: string | null
          assinatura_id: string | null
          assinatura_token: string | null
          assinatura_url: string | null
          atualizado_por: string | null
          base_cliente_id: string
          conteudo_html: string | null
          created_at: string
          criado_por: string | null
          data_assinatura: string | null
          data_envio_assinatura: string | null
          data_fim: string | null
          data_inicio: string | null
          dia_vencimento: number | null
          id: string
          lojas_incluidas: number | null
          modelo_id: string | null
          numero_contrato: string | null
          observacoes: string | null
          pdf_url: string | null
          plano: string | null
          status: string
          tipo_contrato: string
          updated_at: string
          usuarios_incluidos: number | null
          valor_implantacao: number | null
          valor_mensal: number | null
        }
        Insert: {
          armazenamento_adicional_mb?: number | null
          armazenamento_incluido_mb?: number | null
          arquivo_assinado_url?: string | null
          assinante_documento?: string | null
          assinante_email?: string | null
          assinante_ip?: string | null
          assinante_nome?: string | null
          assinante_user_agent?: string | null
          assinatura_id?: string | null
          assinatura_token?: string | null
          assinatura_url?: string | null
          atualizado_por?: string | null
          base_cliente_id: string
          conteudo_html?: string | null
          created_at?: string
          criado_por?: string | null
          data_assinatura?: string | null
          data_envio_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          id?: string
          lojas_incluidas?: number | null
          modelo_id?: string | null
          numero_contrato?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          plano?: string | null
          status?: string
          tipo_contrato?: string
          updated_at?: string
          usuarios_incluidos?: number | null
          valor_implantacao?: number | null
          valor_mensal?: number | null
        }
        Update: {
          armazenamento_adicional_mb?: number | null
          armazenamento_incluido_mb?: number | null
          arquivo_assinado_url?: string | null
          assinante_documento?: string | null
          assinante_email?: string | null
          assinante_ip?: string | null
          assinante_nome?: string | null
          assinante_user_agent?: string | null
          assinatura_id?: string | null
          assinatura_token?: string | null
          assinatura_url?: string | null
          atualizado_por?: string | null
          base_cliente_id?: string
          conteudo_html?: string | null
          created_at?: string
          criado_por?: string | null
          data_assinatura?: string | null
          data_envio_assinatura?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          id?: string
          lojas_incluidas?: number | null
          modelo_id?: string | null
          numero_contrato?: string | null
          observacoes?: string | null
          pdf_url?: string | null
          plano?: string | null
          status?: string
          tipo_contrato?: string
          updated_at?: string
          usuarios_incluidos?: number | null
          valor_implantacao?: number | null
          valor_mensal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "base_contratos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "base_assinaturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_contratos_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_contratos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "base_modelos_contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      base_modelos_contrato: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          conteudo_html: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          padrao: boolean
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          conteudo_html?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          padrao?: boolean
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          conteudo_html?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          padrao?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      bases_clientes: {
        Row: {
          atualizado_por: string | null
          cnpj: string | null
          created_at: string
          criado_por: string | null
          data_cancelamento: string | null
          data_inicio: string | null
          email_responsavel: string | null
          id: string
          nome: string
          nome_fantasia: string | null
          observacoes: string | null
          plano: string
          razao_social: string | null
          responsavel_nome: string | null
          sistema_saas_id: string | null
          status: string
          telefone_responsavel: string | null
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por?: string | null
          data_cancelamento?: string | null
          data_inicio?: string | null
          email_responsavel?: string | null
          id?: string
          nome: string
          nome_fantasia?: string | null
          observacoes?: string | null
          plano?: string
          razao_social?: string | null
          responsavel_nome?: string | null
          sistema_saas_id?: string | null
          status?: string
          telefone_responsavel?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por?: string | null
          data_cancelamento?: string | null
          data_inicio?: string | null
          email_responsavel?: string | null
          id?: string
          nome?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          plano?: string
          razao_social?: string | null
          responsavel_nome?: string | null
          sistema_saas_id?: string | null
          status?: string
          telefone_responsavel?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bases_clientes_sistema_saas_id_fkey"
            columns: ["sistema_saas_id"]
            isOneToOne: false
            referencedRelation: "sistemas_saas"
            referencedColumns: ["id"]
          },
        ]
      }
      bases_clientes_historico: {
        Row: {
          base_id: string
          created_at: string
          descricao: string | null
          detalhes: Json | null
          evento: string
          id: string
          usuario_id: string | null
        }
        Insert: {
          base_id: string
          created_at?: string
          descricao?: string | null
          detalhes?: Json | null
          evento: string
          id?: string
          usuario_id?: string | null
        }
        Update: {
          base_id?: string
          created_at?: string
          descricao?: string | null
          detalhes?: Json | null
          evento?: string
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bases_clientes_historico_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cartoes_credito: {
        Row: {
          ativo: boolean | null
          bandeira: string | null
          conta_id: string | null
          created_at: string
          dia_fechamento: number | null
          dia_vencimento: number | null
          id: string
          loja_id: string | null
          nome: string
          ultimos_digitos: string | null
        }
        Insert: {
          ativo?: boolean | null
          bandeira?: string | null
          conta_id?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          loja_id?: string | null
          nome: string
          ultimos_digitos?: string | null
        }
        Update: {
          ativo?: boolean | null
          bandeira?: string | null
          conta_id?: string | null
          created_at?: string
          dia_fechamento?: number | null
          dia_vencimento?: number | null
          id?: string
          loja_id?: string | null
          nome?: string
          ultimos_digitos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cartoes_credito_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          contabilizar_dre: boolean
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          ordem: number | null
          parent_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          contabilizar_dre?: boolean
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          ordem?: number | null
          parent_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          contabilizar_dre?: boolean
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          ordem?: number | null
          parent_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          loja_id: string | null
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados_digitais: {
        Row: {
          cnpj_certificado: string | null
          configuracao_fiscal_id: string | null
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          razao_social_certificado: string | null
          senha_algoritmo: string | null
          senha_cifrada: string | null
          senha_encrypted: string | null
          senha_iv: string | null
          senha_tag: string | null
          status: string
          storage_path: string
          tipo_certificado: string
          ultimo_teste_em: string | null
          ultimo_uso_em: string | null
          updated_at: string
          uploaded_by: string | null
          validade_fim: string | null
          validade_inicio: string | null
        }
        Insert: {
          cnpj_certificado?: string | null
          configuracao_fiscal_id?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          razao_social_certificado?: string | null
          senha_algoritmo?: string | null
          senha_cifrada?: string | null
          senha_encrypted?: string | null
          senha_iv?: string | null
          senha_tag?: string | null
          status?: string
          storage_path: string
          tipo_certificado?: string
          ultimo_teste_em?: string | null
          ultimo_uso_em?: string | null
          updated_at?: string
          uploaded_by?: string | null
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Update: {
          cnpj_certificado?: string | null
          configuracao_fiscal_id?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          razao_social_certificado?: string | null
          senha_algoritmo?: string | null
          senha_cifrada?: string | null
          senha_encrypted?: string | null
          senha_iv?: string | null
          senha_tag?: string | null
          status?: string
          storage_path?: string
          tipo_certificado?: string
          ultimo_teste_em?: string | null
          ultimo_uso_em?: string | null
          updated_at?: string
          uploaded_by?: string | null
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificados_digitais_configuracao_fiscal_id_fkey"
            columns: ["configuracao_fiscal_id"]
            isOneToOne: false
            referencedRelation: "configuracoes_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          assistencia_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          montador_id: string | null
        }
        Insert: {
          assistencia_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          montador_id?: string | null
        }
        Update: {
          assistencia_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          montador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_assistencia_id_fkey"
            columns: ["assistencia_id"]
            isOneToOne: false
            referencedRelation: "assistencias"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_itens: {
        Row: {
          created_at: string
          descricao: string
          id: string
          obrigatorio: boolean | null
          ordem: number | null
          template_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          template_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_itens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          nome: string
          ordem: number | null
          tipo_servico: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number | null
          tipo_servico: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number | null
          tipo_servico?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean | null
          cpf_cnpj: string | null
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          email: string | null
          endereco_cobranca: string | null
          endereco_entrega: string | null
          id: string
          loja_id: string | null
          nome: string
          observacoes: string | null
          origem_id: string | null
          parceiro_id: string | null
          telefone: string | null
          telefone_secundario: string | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco_cobranca?: string | null
          endereco_entrega?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          observacoes?: string | null
          origem_id?: string | null
          parceiro_id?: string | null
          telefone?: string | null
          telefone_secundario?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco_cobranca?: string | null
          endereco_entrega?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          observacoes?: string | null
          origem_id?: string | null
          parceiro_id?: string | null
          telefone?: string | null
          telefone_secundario?: string | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens_lead"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados_saas: {
        Row: {
          anexo_mime: string | null
          anexo_nome: string | null
          anexo_tamanho_bytes: number | null
          anexo_texto_botao: string | null
          anexo_tipo: string | null
          anexo_url: string | null
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string | null
          exibir_popup: boolean
          id: string
          link_url: string | null
          mensagem: string
          permitir_fechar: boolean
          prioridade: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          anexo_mime?: string | null
          anexo_nome?: string | null
          anexo_tamanho_bytes?: number | null
          anexo_texto_botao?: string | null
          anexo_tipo?: string | null
          anexo_url?: string | null
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          exibir_popup?: boolean
          id?: string
          link_url?: string | null
          mensagem: string
          permitir_fechar?: boolean
          prioridade?: string
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          anexo_mime?: string | null
          anexo_nome?: string | null
          anexo_tamanho_bytes?: number | null
          anexo_texto_botao?: string | null
          anexo_tipo?: string | null
          anexo_url?: string | null
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          exibir_popup?: boolean
          id?: string
          link_url?: string | null
          mensagem?: string
          permitir_fechar?: boolean
          prioridade?: string
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      comunicados_saas_destinatarios: {
        Row: {
          base_cliente_id: string | null
          comunicado_id: string
          created_at: string
          enviar_para_todas_bases: boolean
          id: string
          loja_id: string | null
        }
        Insert: {
          base_cliente_id?: string | null
          comunicado_id: string
          created_at?: string
          enviar_para_todas_bases?: boolean
          id?: string
          loja_id?: string | null
        }
        Update: {
          base_cliente_id?: string | null
          comunicado_id?: string
          created_at?: string
          enviar_para_todas_bases?: boolean
          id?: string
          loja_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_saas_destinatarios_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados_saas"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicados_saas_leituras: {
        Row: {
          base_cliente_id: string | null
          comunicado_id: string
          created_at: string
          fechado_em: string | null
          id: string
          lido: boolean
          lido_em: string | null
          loja_id: string | null
          user_id: string
        }
        Insert: {
          base_cliente_id?: string | null
          comunicado_id: string
          created_at?: string
          fechado_em?: string | null
          id?: string
          lido?: boolean
          lido_em?: string | null
          loja_id?: string | null
          user_id: string
        }
        Update: {
          base_cliente_id?: string | null
          comunicado_id?: string
          created_at?: string
          fechado_em?: string | null
          id?: string
          lido?: boolean
          lido_em?: string | null
          loja_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunicados_saas_leituras_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "comunicados_saas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_empresa: {
        Row: {
          assinar_loja_automaticamente: boolean
          cnpj: string | null
          comissao_bronze_ate: number | null
          comissao_bronze_perc: number | null
          comissao_loja_perc: number | null
          comissao_ouro_perc: number | null
          comissao_prata_ate: number | null
          comissao_prata_perc: number | null
          created_at: string
          desconto_maximo: number | null
          email: string | null
          endereco: string | null
          formacao_preco_extras: Json
          formacao_preco_labels: Json
          frete_compra_perc: number | null
          frete_venda_perc: number | null
          icms_compra_perc: number | null
          id: string
          imp_saida_perc: number | null
          inscricao_estadual: string | null
          logo_url: string | null
          loja_id: string
          markup_padrao: number | null
          montagem_perc: number | null
          mostrar_desconto_contrato: boolean | null
          nome_empresa: string | null
          nome_fantasia: string | null
          outros_perc: number | null
          prazo_entrega_inicio_contagem: string
          prazo_entrega_tipo_dias: string
          prazo_montagem_dias: number
          prazo_montagem_inicio_contagem: string
          prazo_montagem_tipo_dias: string
          prazo_padrao_dias: number | null
          taxa_fixa_perc: number | null
          taxa_modo: string | null
          taxa_responsavel: string | null
          telefone: string | null
          updated_at: string
          usar_markup: boolean | null
          website: string | null
        }
        Insert: {
          assinar_loja_automaticamente?: boolean
          cnpj?: string | null
          comissao_bronze_ate?: number | null
          comissao_bronze_perc?: number | null
          comissao_loja_perc?: number | null
          comissao_ouro_perc?: number | null
          comissao_prata_ate?: number | null
          comissao_prata_perc?: number | null
          created_at?: string
          desconto_maximo?: number | null
          email?: string | null
          endereco?: string | null
          formacao_preco_extras?: Json
          formacao_preco_labels?: Json
          frete_compra_perc?: number | null
          frete_venda_perc?: number | null
          icms_compra_perc?: number | null
          id?: string
          imp_saida_perc?: number | null
          inscricao_estadual?: string | null
          logo_url?: string | null
          loja_id: string
          markup_padrao?: number | null
          montagem_perc?: number | null
          mostrar_desconto_contrato?: boolean | null
          nome_empresa?: string | null
          nome_fantasia?: string | null
          outros_perc?: number | null
          prazo_entrega_inicio_contagem?: string
          prazo_entrega_tipo_dias?: string
          prazo_montagem_dias?: number
          prazo_montagem_inicio_contagem?: string
          prazo_montagem_tipo_dias?: string
          prazo_padrao_dias?: number | null
          taxa_fixa_perc?: number | null
          taxa_modo?: string | null
          taxa_responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          usar_markup?: boolean | null
          website?: string | null
        }
        Update: {
          assinar_loja_automaticamente?: boolean
          cnpj?: string | null
          comissao_bronze_ate?: number | null
          comissao_bronze_perc?: number | null
          comissao_loja_perc?: number | null
          comissao_ouro_perc?: number | null
          comissao_prata_ate?: number | null
          comissao_prata_perc?: number | null
          created_at?: string
          desconto_maximo?: number | null
          email?: string | null
          endereco?: string | null
          formacao_preco_extras?: Json
          formacao_preco_labels?: Json
          frete_compra_perc?: number | null
          frete_venda_perc?: number | null
          icms_compra_perc?: number | null
          id?: string
          imp_saida_perc?: number | null
          inscricao_estadual?: string | null
          logo_url?: string | null
          loja_id?: string
          markup_padrao?: number | null
          montagem_perc?: number | null
          mostrar_desconto_contrato?: boolean | null
          nome_empresa?: string | null
          nome_fantasia?: string | null
          outros_perc?: number | null
          prazo_entrega_inicio_contagem?: string
          prazo_entrega_tipo_dias?: string
          prazo_montagem_dias?: number
          prazo_montagem_inicio_contagem?: string
          prazo_montagem_tipo_dias?: string
          prazo_padrao_dias?: number | null
          taxa_fixa_perc?: number | null
          taxa_modo?: string | null
          taxa_responsavel?: string | null
          telefone?: string | null
          updated_at?: string
          usar_markup?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      configuracoes_fiscais: {
        Row: {
          aliquota_iss_padrao: number | null
          ambiente: string
          cnae_principal: string | null
          cnpj: string | null
          codigo_municipio_ibge: string | null
          codigo_servico_municipal: string | null
          created_at: string
          crt: number | null
          emitir_nfe: boolean
          emitir_nfse: boolean
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          loja_id: string
          municipio: string | null
          nome_fantasia: string | null
          provedor_nfse: string | null
          proximo_numero_nfe: number | null
          proximo_numero_rps: number | null
          razao_social: string | null
          regime_tributario: string | null
          serie_nfe: number | null
          serie_nfse: number | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          aliquota_iss_padrao?: number | null
          ambiente?: string
          cnae_principal?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
          codigo_servico_municipal?: string | null
          created_at?: string
          crt?: number | null
          emitir_nfe?: boolean
          emitir_nfse?: boolean
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          loja_id: string
          municipio?: string | null
          nome_fantasia?: string | null
          provedor_nfse?: string | null
          proximo_numero_nfe?: number | null
          proximo_numero_rps?: number | null
          razao_social?: string | null
          regime_tributario?: string | null
          serie_nfe?: number | null
          serie_nfse?: number | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_iss_padrao?: number | null
          ambiente?: string
          cnae_principal?: string | null
          cnpj?: string | null
          codigo_municipio_ibge?: string | null
          codigo_servico_municipal?: string | null
          created_at?: string
          crt?: number | null
          emitir_nfe?: boolean
          emitir_nfse?: boolean
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          loja_id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          provedor_nfse?: string | null
          proximo_numero_nfe?: number | null
          proximo_numero_rps?: number | null
          razao_social?: string | null
          regime_tributario?: string | null
          serie_nfe?: number | null
          serie_nfse?: number | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_fiscais_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_kanbans: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          chave_kanban: string
          criado_em: string
          descricao: string | null
          id: string
          loja_id: string | null
          nome_kanban: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          chave_kanban: string
          criado_em?: string
          descricao?: string | null
          id?: string
          loja_id?: string | null
          nome_kanban: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          chave_kanban?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          loja_id?: string | null
          nome_kanban?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_kanbans_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco: string | null
          conta: string | null
          cor: string | null
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          saldo_inicial: number | null
          tipo: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          conta?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          saldo_inicial?: number | null
          tipo?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          conta?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          saldo_inicial?: number | null
          tipo?: string | null
        }
        Relationships: []
      }
      contratos: {
        Row: {
          assinado_em: string | null
          assinatura_cpf: string | null
          assinatura_data_url: string | null
          assinatura_ip: string | null
          assinatura_nome: string | null
          cliente_id: string | null
          conteudo_snapshot: Json | null
          created_at: string
          created_by: string | null
          document_hash: string | null
          documento_cliente_url: string | null
          documento_url: string | null
          enviado_em: string | null
          enviado_via: string | null
          id: string
          loja_id: string | null
          metodo_assinatura: string | null
          numero: string
          observacoes_adicionais: string | null
          orcamento_id: string
          pdf_assinado_url: string | null
          selfie_url: string | null
          signing_token: string
          status: string
          template_id: string | null
          updated_at: string
          validation_token: string | null
          valor_total: number
        }
        Insert: {
          assinado_em?: string | null
          assinatura_cpf?: string | null
          assinatura_data_url?: string | null
          assinatura_ip?: string | null
          assinatura_nome?: string | null
          cliente_id?: string | null
          conteudo_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          document_hash?: string | null
          documento_cliente_url?: string | null
          documento_url?: string | null
          enviado_em?: string | null
          enviado_via?: string | null
          id?: string
          loja_id?: string | null
          metodo_assinatura?: string | null
          numero: string
          observacoes_adicionais?: string | null
          orcamento_id: string
          pdf_assinado_url?: string | null
          selfie_url?: string | null
          signing_token?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          validation_token?: string | null
          valor_total?: number
        }
        Update: {
          assinado_em?: string | null
          assinatura_cpf?: string | null
          assinatura_data_url?: string | null
          assinatura_ip?: string | null
          assinatura_nome?: string | null
          cliente_id?: string | null
          conteudo_snapshot?: Json | null
          created_at?: string
          created_by?: string | null
          document_hash?: string | null
          documento_cliente_url?: string | null
          documento_url?: string | null
          enviado_em?: string | null
          enviado_via?: string | null
          id?: string
          loja_id?: string | null
          metodo_assinatura?: string | null
          numero?: string
          observacoes_adicionais?: string | null
          orcamento_id?: string
          pdf_assinado_url?: string | null
          selfie_url?: string | null
          signing_token?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          validation_token?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contratos_template"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_template: {
        Row: {
          ativo: boolean | null
          clausulas: string
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          observacoes_padrao: string | null
          rodape: string | null
          subtitulo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          clausulas?: string
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          observacoes_padrao?: string | null
          rodape?: string | null
          subtitulo?: string | null
          titulo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          clausulas?: string
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          observacoes_padrao?: string | null
          rodape?: string | null
          subtitulo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_template_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automacoes: {
        Row: {
          acao: string
          acao_config: Json
          ajustar_prazo_dias: number | null
          ativo: boolean
          condicao_tipo: string
          condicao_valor: string | null
          created_at: string
          dias: number | null
          estagio_destino_id: string | null
          estagio_origem_id: string
          evento: string
          id: string
          ordem: number
          pipeline_destino: string | null
          updated_at: string
        }
        Insert: {
          acao?: string
          acao_config?: Json
          ajustar_prazo_dias?: number | null
          ativo?: boolean
          condicao_tipo?: string
          condicao_valor?: string | null
          created_at?: string
          dias?: number | null
          estagio_destino_id?: string | null
          estagio_origem_id: string
          evento?: string
          id?: string
          ordem?: number
          pipeline_destino?: string | null
          updated_at?: string
        }
        Update: {
          acao?: string
          acao_config?: Json
          ajustar_prazo_dias?: number | null
          ativo?: boolean
          condicao_tipo?: string
          condicao_valor?: string | null
          created_at?: string
          dias?: number | null
          estagio_destino_id?: string | null
          estagio_origem_id?: string
          evento?: string
          id?: string
          ordem?: number
          pipeline_destino?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_automacoes_estagio_destino_id_fkey"
            columns: ["estagio_destino_id"]
            isOneToOne: false
            referencedRelation: "crm_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_automacoes_estagio_origem_id_fkey"
            columns: ["estagio_origem_id"]
            isOneToOne: false
            referencedRelation: "crm_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_estagios: {
        Row: {
          ativo: boolean
          checklist_template_id: string | null
          concluir_acao: string
          concluir_estagio_destino_id: string | null
          concluir_pipeline_destino: string | null
          cor: string | null
          created_at: string
          criar_card_em: string[]
          id: string
          is_ganho: boolean
          is_perdido: boolean
          nome: string
          ordem: number
          sla_dias_uteis: number | null
        }
        Insert: {
          ativo?: boolean
          checklist_template_id?: string | null
          concluir_acao?: string
          concluir_estagio_destino_id?: string | null
          concluir_pipeline_destino?: string | null
          cor?: string | null
          created_at?: string
          criar_card_em?: string[]
          id?: string
          is_ganho?: boolean
          is_perdido?: boolean
          nome: string
          ordem?: number
          sla_dias_uteis?: number | null
        }
        Update: {
          ativo?: boolean
          checklist_template_id?: string | null
          concluir_acao?: string
          concluir_estagio_destino_id?: string | null
          concluir_pipeline_destino?: string | null
          cor?: string | null
          created_at?: string
          criar_card_em?: string[]
          id?: string
          is_ganho?: boolean
          is_perdido?: boolean
          nome?: string
          ordem?: number
          sla_dias_uteis?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_estagios_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_assinados: {
        Row: {
          codigo_validacao: string
          concluido_em: string
          created_at: string
          final_file_url: string | null
          id: string
          solicitacao_id: string
          storage_path: string | null
        }
        Insert: {
          codigo_validacao: string
          concluido_em?: string
          created_at?: string
          final_file_url?: string | null
          id?: string
          solicitacao_id: string
          storage_path?: string | null
        }
        Update: {
          codigo_validacao?: string
          concluido_em?: string
          created_at?: string
          final_file_url?: string | null
          id?: string
          solicitacao_id?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_assinados_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_assinatura"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_saas_config: {
        Row: {
          atualizado_por: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string | null
          responsavel_cpf: string | null
          responsavel_legal: string | null
          site: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          responsavel_cpf?: string | null
          responsavel_legal?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          responsavel_cpf?: string | null
          responsavel_legal?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      etapas_kanban_fabrica: {
        Row: {
          ativo: boolean
          chave: string
          cor_hex: string | null
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          ordem: number
          prazo_dias_uteis: number | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chave: string
          cor_hex?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          ordem?: number
          prazo_dias_uteis?: number | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chave?: string
          cor_hex?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          ordem?: number
          prazo_dias_uteis?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapas_kanban_fabrica_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      etiquetas: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      eventos_tarefa: {
        Row: {
          anexo_url: string | null
          created_at: string
          id: string
          payload: Json
          tarefa_id: string
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string
          id?: string
          payload?: Json
          tarefa_id: string
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          anexo_url?: string | null
          created_at?: string
          id?: string
          payload?: Json
          tarefa_id?: string
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_tarefa_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas_pedido"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_almoxarifado_historico: {
        Row: {
          codigo_bipado: string | null
          created_at: string
          id: string
          item_id: string | null
          mensagem: string | null
          pedido_id: string
          quantidade: number | null
          resultado: string
          usuario_id: string | null
          volume_id: string | null
        }
        Insert: {
          codigo_bipado?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          mensagem?: string | null
          pedido_id: string
          quantidade?: number | null
          resultado: string
          usuario_id?: string | null
          volume_id?: string | null
        }
        Update: {
          codigo_bipado?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          mensagem?: string | null
          pedido_id?: string
          quantidade?: number | null
          resultado?: string
          usuario_id?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_almoxarifado_historico_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fabrica_almoxarifado_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_almoxarifado_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_almoxarifado_historico_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "fabrica_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_almoxarifado_itens: {
        Row: {
          atualizado_por: string | null
          codigo_barras: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          estoque_atual: number | null
          id: string
          lote_id: string | null
          observacoes: string | null
          pedido_id: string
          quantidade_necessaria: number
          quantidade_separada: number
          referencia: string
          status: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          codigo_barras?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          estoque_atual?: number | null
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          pedido_id: string
          quantidade_necessaria?: number
          quantidade_separada?: number
          referencia: string
          status?: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          codigo_barras?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          estoque_atual?: number | null
          id?: string
          lote_id?: string | null
          observacoes?: string | null
          pedido_id?: string
          quantidade_necessaria?: number
          quantidade_separada?: number
          referencia?: string
          status?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_almoxarifado_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_arquivos_producao: {
        Row: {
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          id: string
          lote_id: string | null
          mime_type: string | null
          nome_arquivo: string
          obrigatorio: boolean
          observacoes: string | null
          pedido_id: string
          processado: boolean
          tamanho_bytes: number | null
          tipo_arquivo: string
          updated_at: string
          url_arquivo: string
        }
        Insert: {
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          lote_id?: string | null
          mime_type?: string | null
          nome_arquivo: string
          obrigatorio?: boolean
          observacoes?: string | null
          pedido_id: string
          processado?: boolean
          tamanho_bytes?: number | null
          tipo_arquivo: string
          updated_at?: string
          url_arquivo: string
        }
        Update: {
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          lote_id?: string | null
          mime_type?: string | null
          nome_arquivo?: string
          obrigatorio?: boolean
          observacoes?: string | null
          pedido_id?: string
          processado?: boolean
          tamanho_bytes?: number | null
          tipo_arquivo?: string
          updated_at?: string
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_arquivos_producao_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_arquivos_tecnicos: {
        Row: {
          caminho_relativo: string | null
          chapa_id: string | null
          created_at: string
          criado_por: string | null
          dados_extraidos: Json | null
          extensao: string | null
          id: string
          importacao_id: string
          loja_id: string | null
          lote_id: string | null
          mime_type: string | null
          nome_arquivo: string
          origem_pasta: string
          peca_id: string | null
          pedido_id: string | null
          processado: boolean
          status_arquivo: string
          tamanho_bytes: number | null
          tipo_arquivo: string
          updated_at: string
          url_arquivo: string | null
        }
        Insert: {
          caminho_relativo?: string | null
          chapa_id?: string | null
          created_at?: string
          criado_por?: string | null
          dados_extraidos?: Json | null
          extensao?: string | null
          id?: string
          importacao_id: string
          loja_id?: string | null
          lote_id?: string | null
          mime_type?: string | null
          nome_arquivo: string
          origem_pasta?: string
          peca_id?: string | null
          pedido_id?: string | null
          processado?: boolean
          status_arquivo?: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string
          updated_at?: string
          url_arquivo?: string | null
        }
        Update: {
          caminho_relativo?: string | null
          chapa_id?: string | null
          created_at?: string
          criado_por?: string | null
          dados_extraidos?: Json | null
          extensao?: string | null
          id?: string
          importacao_id?: string
          loja_id?: string | null
          lote_id?: string | null
          mime_type?: string | null
          nome_arquivo?: string
          origem_pasta?: string
          peca_id?: string | null
          pedido_id?: string | null
          processado?: boolean
          status_arquivo?: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string
          updated_at?: string
          url_arquivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_arquivos_tecnicos_chapa_id_fkey"
            columns: ["chapa_id"]
            isOneToOne: false
            referencedRelation: "fabrica_chapas_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_arquivos_tecnicos_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_importacoes_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_arquivos_tecnicos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_arquivos_tecnicos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_chapas_lote: {
        Row: {
          altura_chapa: number
          aproveitamento: number | null
          arquivo_cyc_id: string | null
          arquivo_nc_id: string | null
          cor_linha: string | null
          created_at: string
          espessura: number | null
          id: string
          importacao_id: string
          largura_chapa: number
          loja_id: string | null
          lote_id: string | null
          material: string | null
          numero_chapa: string | null
          ordem_chapa: number | null
          pedido_id: string | null
          preview_large_id: string | null
          preview_small_id: string | null
          status_chapa: string
          updated_at: string
        }
        Insert: {
          altura_chapa?: number
          aproveitamento?: number | null
          arquivo_cyc_id?: string | null
          arquivo_nc_id?: string | null
          cor_linha?: string | null
          created_at?: string
          espessura?: number | null
          id?: string
          importacao_id: string
          largura_chapa?: number
          loja_id?: string | null
          lote_id?: string | null
          material?: string | null
          numero_chapa?: string | null
          ordem_chapa?: number | null
          pedido_id?: string | null
          preview_large_id?: string | null
          preview_small_id?: string | null
          status_chapa?: string
          updated_at?: string
        }
        Update: {
          altura_chapa?: number
          aproveitamento?: number | null
          arquivo_cyc_id?: string | null
          arquivo_nc_id?: string | null
          cor_linha?: string | null
          created_at?: string
          espessura?: number | null
          id?: string
          importacao_id?: string
          largura_chapa?: number
          loja_id?: string | null
          lote_id?: string | null
          material?: string | null
          numero_chapa?: string | null
          ordem_chapa?: number | null
          pedido_id?: string | null
          preview_large_id?: string | null
          preview_small_id?: string | null
          status_chapa?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_chapas_lote_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_importacoes_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_chapas_lote_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_chapas_lote_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_conferencia_historico: {
        Row: {
          codigo_bipado: string | null
          created_at: string
          id: string
          lote_id: string | null
          mensagem: string | null
          peca_id: string | null
          pedido_id: string
          resultado: string
          usuario_id: string | null
          volume_id: string | null
        }
        Insert: {
          codigo_bipado?: string | null
          created_at?: string
          id?: string
          lote_id?: string | null
          mensagem?: string | null
          peca_id?: string | null
          pedido_id: string
          resultado: string
          usuario_id?: string | null
          volume_id?: string | null
        }
        Update: {
          codigo_bipado?: string | null
          created_at?: string
          id?: string
          lote_id?: string | null
          mensagem?: string | null
          peca_id?: string | null
          pedido_id?: string
          resultado?: string
          usuario_id?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_conferencia_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_etiquetas: {
        Row: {
          arquivo_bmp_id: string | null
          arquivo_etiqueta_id: string | null
          arquivo_pdf_id: string | null
          chapa_id: string | null
          codigo_barras: string | null
          codigo_etiqueta_completo: string
          codigo_peca: string | null
          created_at: string
          id: string
          importacao_id: string
          indice_duplicidade: number | null
          loja_id: string | null
          lote_id: string | null
          peca_id: string | null
          pedido_id: string | null
          referencia_peca: string | null
          sufixo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_bmp_id?: string | null
          arquivo_etiqueta_id?: string | null
          arquivo_pdf_id?: string | null
          chapa_id?: string | null
          codigo_barras?: string | null
          codigo_etiqueta_completo: string
          codigo_peca?: string | null
          created_at?: string
          id?: string
          importacao_id: string
          indice_duplicidade?: number | null
          loja_id?: string | null
          lote_id?: string | null
          peca_id?: string | null
          pedido_id?: string | null
          referencia_peca?: string | null
          sufixo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_bmp_id?: string | null
          arquivo_etiqueta_id?: string | null
          arquivo_pdf_id?: string | null
          chapa_id?: string | null
          codigo_barras?: string | null
          codigo_etiqueta_completo?: string
          codigo_peca?: string | null
          created_at?: string
          id?: string
          importacao_id?: string
          indice_duplicidade?: number | null
          loja_id?: string | null
          lote_id?: string | null
          peca_id?: string | null
          pedido_id?: string | null
          referencia_peca?: string | null
          sufixo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_etiquetas_arquivo_bmp_id_fkey"
            columns: ["arquivo_bmp_id"]
            isOneToOne: false
            referencedRelation: "fabrica_arquivos_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_etiquetas_arquivo_etiqueta_id_fkey"
            columns: ["arquivo_etiqueta_id"]
            isOneToOne: false
            referencedRelation: "fabrica_arquivos_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_etiquetas_arquivo_pdf_id_fkey"
            columns: ["arquivo_pdf_id"]
            isOneToOne: false
            referencedRelation: "fabrica_arquivos_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_etiquetas_chapa_id_fkey"
            columns: ["chapa_id"]
            isOneToOne: false
            referencedRelation: "fabrica_chapas_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_etiquetas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_importacoes_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_etiquetas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_etiquetas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_expedicao_historico: {
        Row: {
          codigo_bipado: string | null
          created_at: string
          id: string
          mensagem: string | null
          pedido_id: string
          resultado: string
          usuario_id: string | null
          volume_id: string | null
        }
        Insert: {
          codigo_bipado?: string | null
          created_at?: string
          id?: string
          mensagem?: string | null
          pedido_id: string
          resultado: string
          usuario_id?: string | null
          volume_id?: string | null
        }
        Update: {
          codigo_bipado?: string | null
          created_at?: string
          id?: string
          mensagem?: string | null
          pedido_id?: string
          resultado?: string
          usuario_id?: string | null
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_expedicao_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_expedicao_historico_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "fabrica_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_importacoes_tecnicas: {
        Row: {
          ambiente: string | null
          arquivo_original_nome: string | null
          arquivo_original_url: string | null
          cliente_nome: string | null
          created_at: string
          data_importacao: string
          id: string
          loja_id: string | null
          lote_id: string | null
          mensagem_processamento: string | null
          modo_importacao: string
          pedido_id: string | null
          projeto_nome: string | null
          status_importacao: string
          tipo_importacao: string
          total_arquivos: number
          total_arquivos_tecnicos: number
          total_chapas: number
          total_etiquetas: number
          total_pecas: number
          updated_at: string
          usuario_importacao: string | null
        }
        Insert: {
          ambiente?: string | null
          arquivo_original_nome?: string | null
          arquivo_original_url?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_importacao?: string
          id?: string
          loja_id?: string | null
          lote_id?: string | null
          mensagem_processamento?: string | null
          modo_importacao?: string
          pedido_id?: string | null
          projeto_nome?: string | null
          status_importacao?: string
          tipo_importacao?: string
          total_arquivos?: number
          total_arquivos_tecnicos?: number
          total_chapas?: number
          total_etiquetas?: number
          total_pecas?: number
          updated_at?: string
          usuario_importacao?: string | null
        }
        Update: {
          ambiente?: string | null
          arquivo_original_nome?: string | null
          arquivo_original_url?: string | null
          cliente_nome?: string | null
          created_at?: string
          data_importacao?: string
          id?: string
          loja_id?: string | null
          lote_id?: string | null
          mensagem_processamento?: string | null
          modo_importacao?: string
          pedido_id?: string | null
          projeto_nome?: string | null
          status_importacao?: string
          tipo_importacao?: string
          total_arquivos?: number
          total_arquivos_tecnicos?: number
          total_chapas?: number
          total_etiquetas?: number
          total_pecas?: number
          updated_at?: string
          usuario_importacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_importacoes_tecnicas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_importacoes_tecnicas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_modulos: {
        Row: {
          ambiente: string | null
          atualizado_por: string | null
          codigo_modulo: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          lote_id: string | null
          nome_modulo: string | null
          ordem: number | null
          pedido_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ambiente?: string | null
          atualizado_por?: string | null
          codigo_modulo: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          lote_id?: string | null
          nome_modulo?: string | null
          ordem?: number | null
          pedido_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ambiente?: string | null
          atualizado_por?: string | null
          codigo_modulo?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          lote_id?: string | null
          nome_modulo?: string | null
          ordem?: number | null
          pedido_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_modulos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_ocorrencias: {
        Row: {
          aberto_por: string | null
          almoxarifado_item_id: string | null
          atualizado_por: string | null
          bloqueante: boolean
          codigo: string | null
          created_at: string
          data_abertura: string
          data_previsao_resolucao: string | null
          data_resolucao: string | null
          descricao: string | null
          id: string
          loja_id: string | null
          lote_id: string | null
          modulo_id: string | null
          observacoes: string | null
          peca_id: string | null
          pedido_id: string
          prioridade: string
          quantidade_afetada: number | null
          responsavel_id: string | null
          setor_responsavel: string
          solucao_descricao: string | null
          status: string
          tipo_ocorrencia: string
          titulo: string
          updated_at: string
          volume_id: string | null
        }
        Insert: {
          aberto_por?: string | null
          almoxarifado_item_id?: string | null
          atualizado_por?: string | null
          bloqueante?: boolean
          codigo?: string | null
          created_at?: string
          data_abertura?: string
          data_previsao_resolucao?: string | null
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          lote_id?: string | null
          modulo_id?: string | null
          observacoes?: string | null
          peca_id?: string | null
          pedido_id: string
          prioridade?: string
          quantidade_afetada?: number | null
          responsavel_id?: string | null
          setor_responsavel?: string
          solucao_descricao?: string | null
          status?: string
          tipo_ocorrencia: string
          titulo: string
          updated_at?: string
          volume_id?: string | null
        }
        Update: {
          aberto_por?: string | null
          almoxarifado_item_id?: string | null
          atualizado_por?: string | null
          bloqueante?: boolean
          codigo?: string | null
          created_at?: string
          data_abertura?: string
          data_previsao_resolucao?: string | null
          data_resolucao?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          lote_id?: string | null
          modulo_id?: string | null
          observacoes?: string | null
          peca_id?: string | null
          pedido_id?: string
          prioridade?: string
          quantidade_afetada?: number | null
          responsavel_id?: string | null
          setor_responsavel?: string
          solucao_descricao?: string | null
          status?: string
          tipo_ocorrencia?: string
          titulo?: string
          updated_at?: string
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_ocorrencias_almoxarifado_item_id_fkey"
            columns: ["almoxarifado_item_id"]
            isOneToOne: false
            referencedRelation: "fabrica_almoxarifado_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ocorrencias_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "fabrica_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ocorrencias_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: false
            referencedRelation: "fabrica_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ocorrencias_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_ocorrencias_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "fabrica_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_ocorrencias_anexos: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          ocorrencia_id: string
          tamanho_bytes: number | null
          url_arquivo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          ocorrencia_id: string
          tamanho_bytes?: number | null
          url_arquivo: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          ocorrencia_id?: string
          tamanho_bytes?: number | null
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_ocorrencias_anexos_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_ocorrencias_historico: {
        Row: {
          created_at: string
          criado_por: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          ocorrencia_id: string
          status_anterior: string | null
          status_novo: string | null
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ocorrencia_id: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ocorrencia_id?: string
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_ocorrencias_historico_ocorrencia_id_fkey"
            columns: ["ocorrencia_id"]
            isOneToOne: false
            referencedRelation: "fabrica_ocorrencias"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_peca_operacoes: {
        Row: {
          arquivo_tecnico_id: string | null
          created_at: string
          dados_brutos: string | null
          diametro: number | null
          face: string | null
          id: string
          importacao_id: string
          loja_id: string | null
          lote_id: string | null
          origem_pasta: string | null
          peca_id: string | null
          pedido_id: string | null
          posicao_x: number | null
          posicao_y: number | null
          posicao_z: number | null
          profundidade: number | null
          tipo_operacao: string
        }
        Insert: {
          arquivo_tecnico_id?: string | null
          created_at?: string
          dados_brutos?: string | null
          diametro?: number | null
          face?: string | null
          id?: string
          importacao_id: string
          loja_id?: string | null
          lote_id?: string | null
          origem_pasta?: string | null
          peca_id?: string | null
          pedido_id?: string | null
          posicao_x?: number | null
          posicao_y?: number | null
          posicao_z?: number | null
          profundidade?: number | null
          tipo_operacao: string
        }
        Update: {
          arquivo_tecnico_id?: string | null
          created_at?: string
          dados_brutos?: string | null
          diametro?: number | null
          face?: string | null
          id?: string
          importacao_id?: string
          loja_id?: string | null
          lote_id?: string | null
          origem_pasta?: string | null
          peca_id?: string | null
          pedido_id?: string | null
          posicao_x?: number | null
          posicao_y?: number | null
          posicao_z?: number | null
          profundidade?: number | null
          tipo_operacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_peca_operacoes_arquivo_tecnico_id_fkey"
            columns: ["arquivo_tecnico_id"]
            isOneToOne: false
            referencedRelation: "fabrica_arquivos_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_peca_operacoes_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_importacoes_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_peca_operacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_peca_operacoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_pecas: {
        Row: {
          atualizado_por: string | null
          codigo_barras: string | null
          codigo_peca: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          lote_id: string | null
          medida_altura: number | null
          medida_largura: number | null
          medida_profundidade: number | null
          medida_texto: string | null
          modulo_id: string | null
          observacoes: string | null
          pedido_id: string
          quantidade: number
          referencia: string | null
          status: string
          unidade: string | null
          updated_at: string
          volume_id: string | null
        }
        Insert: {
          atualizado_por?: string | null
          codigo_barras?: string | null
          codigo_peca: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          lote_id?: string | null
          medida_altura?: number | null
          medida_largura?: number | null
          medida_profundidade?: number | null
          medida_texto?: string | null
          modulo_id?: string | null
          observacoes?: string | null
          pedido_id: string
          quantidade?: number
          referencia?: string | null
          status?: string
          unidade?: string | null
          updated_at?: string
          volume_id?: string | null
        }
        Update: {
          atualizado_por?: string | null
          codigo_barras?: string | null
          codigo_peca?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          lote_id?: string | null
          medida_altura?: number | null
          medida_largura?: number | null
          medida_profundidade?: number | null
          medida_texto?: string | null
          modulo_id?: string | null
          observacoes?: string | null
          pedido_id?: string
          quantidade?: number
          referencia?: string | null
          status?: string
          unidade?: string | null
          updated_at?: string
          volume_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_pecas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "fabrica_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_pecas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_plano_corte_pecas: {
        Row: {
          altura: number | null
          ambiente: string | null
          chapa_id: string
          codigo_peca: string | null
          cor_linha: string | null
          created_at: string
          dados_origem: Json | null
          descricao: string | null
          espessura: number | null
          etiqueta_id: string | null
          id: string
          importacao_id: string
          indice_peca: number | null
          largura: number | null
          loja_id: string | null
          lote_id: string | null
          material: string | null
          modulo_pai: string | null
          peca_id: string | null
          pedido_id: string | null
          posicao_x: number | null
          posicao_y: number | null
          referencia_peca: string | null
          rotacao: number | null
          status_item: string
          tipo_item: string
          updated_at: string
        }
        Insert: {
          altura?: number | null
          ambiente?: string | null
          chapa_id: string
          codigo_peca?: string | null
          cor_linha?: string | null
          created_at?: string
          dados_origem?: Json | null
          descricao?: string | null
          espessura?: number | null
          etiqueta_id?: string | null
          id?: string
          importacao_id: string
          indice_peca?: number | null
          largura?: number | null
          loja_id?: string | null
          lote_id?: string | null
          material?: string | null
          modulo_pai?: string | null
          peca_id?: string | null
          pedido_id?: string | null
          posicao_x?: number | null
          posicao_y?: number | null
          referencia_peca?: string | null
          rotacao?: number | null
          status_item?: string
          tipo_item?: string
          updated_at?: string
        }
        Update: {
          altura?: number | null
          ambiente?: string | null
          chapa_id?: string
          codigo_peca?: string | null
          cor_linha?: string | null
          created_at?: string
          dados_origem?: Json | null
          descricao?: string | null
          espessura?: number | null
          etiqueta_id?: string | null
          id?: string
          importacao_id?: string
          indice_peca?: number | null
          largura?: number | null
          loja_id?: string | null
          lote_id?: string | null
          material?: string | null
          modulo_pai?: string | null
          peca_id?: string | null
          pedido_id?: string | null
          posicao_x?: number | null
          posicao_y?: number | null
          referencia_peca?: string | null
          rotacao?: number | null
          status_item?: string
          tipo_item?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_plano_corte_pecas_chapa_id_fkey"
            columns: ["chapa_id"]
            isOneToOne: false
            referencedRelation: "fabrica_chapas_lote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_plano_corte_pecas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "fabrica_etiquetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_plano_corte_pecas_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "fabrica_importacoes_tecnicas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_plano_corte_pecas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_plano_corte_pecas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_requisicoes_compra: {
        Row: {
          ambiente: string | null
          anexos: Json
          cliente_nome: string | null
          comprovante_url: string | null
          created_at: string
          created_by: string | null
          data_prevista: string | null
          descricao: string | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          item: string
          liberado_em: string | null
          liberado_por: string | null
          liberado_sem_item: boolean
          loja_id: string | null
          observacoes: string | null
          pedido_id: string | null
          quantidade: number
          status: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          ambiente?: string | null
          anexos?: Json
          cliente_nome?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          item: string
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_sem_item?: boolean
          loja_id?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          quantidade?: number
          status?: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          ambiente?: string | null
          anexos?: Json
          cliente_nome?: string | null
          comprovante_url?: string | null
          created_at?: string
          created_by?: string | null
          data_prevista?: string | null
          descricao?: string | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          item?: string
          liberado_em?: string | null
          liberado_por?: string | null
          liberado_sem_item?: boolean
          loja_id?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          quantidade?: number
          status?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fabrica_volume_almoxarifado_itens: {
        Row: {
          almoxarifado_item_id: string
          created_at: string
          criado_por: string | null
          id: string
          observacoes: string | null
          pedido_id: string
          quantidade: number
          volume_id: string
        }
        Insert: {
          almoxarifado_item_id: string
          created_at?: string
          criado_por?: string | null
          id?: string
          observacoes?: string | null
          pedido_id: string
          quantidade?: number
          volume_id: string
        }
        Update: {
          almoxarifado_item_id?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          observacoes?: string | null
          pedido_id?: string
          quantidade?: number
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_volume_almoxarifado_itens_almoxarifado_item_id_fkey"
            columns: ["almoxarifado_item_id"]
            isOneToOne: false
            referencedRelation: "fabrica_almoxarifado_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_volume_almoxarifado_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_volume_almoxarifado_itens_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "fabrica_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_volume_pecas: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          peca_id: string
          pedido_id: string
          volume_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          peca_id: string
          pedido_id: string
          volume_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          peca_id?: string
          pedido_id?: string
          volume_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_volume_pecas_peca_id_fkey"
            columns: ["peca_id"]
            isOneToOne: true
            referencedRelation: "fabrica_pecas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_volume_pecas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fabrica_volume_pecas_volume_id_fkey"
            columns: ["volume_id"]
            isOneToOne: false
            referencedRelation: "fabrica_volumes"
            referencedColumns: ["id"]
          },
        ]
      }
      fabrica_volumes: {
        Row: {
          atualizado_por: string | null
          carregado_em: string | null
          carregado_por: string | null
          codigo_barras: string
          created_at: string
          criado_por: string | null
          id: string
          lote_id: string | null
          numero_volume: number
          observacao_expedicao: string | null
          observacoes: string | null
          pedido_id: string
          problema_expedicao: boolean
          quantidade_pecas: number
          status: string
          tipo_volume: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          carregado_em?: string | null
          carregado_por?: string | null
          codigo_barras: string
          created_at?: string
          criado_por?: string | null
          id?: string
          lote_id?: string | null
          numero_volume: number
          observacao_expedicao?: string | null
          observacoes?: string | null
          pedido_id: string
          problema_expedicao?: boolean
          quantidade_pecas?: number
          status?: string
          tipo_volume?: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          carregado_em?: string | null
          carregado_por?: string | null
          codigo_barras?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          lote_id?: string | null
          numero_volume?: number
          observacao_expedicao?: string | null
          observacoes?: string | null
          pedido_id?: string
          problema_expedicao?: boolean
          quantidade_pecas?: number
          status?: string
          tipo_volume?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabrica_volumes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      fornecedores: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          categoria: string | null
          cep: string | null
          cidade: string | null
          conta: string | null
          contato: string | null
          created_at: string
          documento: string | null
          email: string | null
          endereco: string | null
          endereco_cobranca: string | null
          endereco_entrega: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          loja_id: string | null
          nome: string
          observacoes: string | null
          pix: string | null
          telefone: string | null
          tipo_documento: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          categoria?: string | null
          cep?: string | null
          cidade?: string | null
          conta?: string | null
          contato?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          endereco_cobranca?: string | null
          endereco_entrega?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          loja_id?: string | null
          nome: string
          observacoes?: string | null
          pix?: string | null
          telefone?: string | null
          tipo_documento?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          categoria?: string | null
          cep?: string | null
          cidade?: string | null
          conta?: string | null
          contato?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          endereco?: string | null
          endereco_cobranca?: string | null
          endereco_entrega?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          loja_id?: string | null
          nome?: string
          observacoes?: string | null
          pix?: string | null
          telefone?: string | null
          tipo_documento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fotos_assistencia: {
        Row: {
          assistencia_id: string
          created_at: string
          id: string
          tipo: string | null
          url: string
        }
        Insert: {
          assistencia_id: string
          created_at?: string
          id?: string
          tipo?: string | null
          url: string
        }
        Update: {
          assistencia_id?: string
          created_at?: string
          id?: string
          tipo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_assistencia_assistencia_id_fkey"
            columns: ["assistencia_id"]
            isOneToOne: false
            referencedRelation: "assistencias"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_cards: {
        Row: {
          created_at: string
          estagio_id: string
          id: string
          iniciado_em: string
          notificacao_atraso_em: string | null
          pedido_id: string
          pipeline: string
          prazo: string | null
          responsavel_id: string | null
          sla_dias_uteis: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estagio_id: string
          id?: string
          iniciado_em?: string
          notificacao_atraso_em?: string | null
          pedido_id: string
          pipeline: string
          prazo?: string | null
          responsavel_id?: string | null
          sla_dias_uteis?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estagio_id?: string
          id?: string
          iniciado_em?: string
          notificacao_atraso_em?: string | null
          pedido_id?: string
          pipeline?: string
          prazo?: string | null
          responsavel_id?: string | null
          sla_dias_uteis?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_cards_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_cards_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_financeiros: {
        Row: {
          adendo_pedido_id: string | null
          agrupado: boolean
          aprovacao_motivo: string | null
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          baixado_em: string | null
          baixado_por: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          comprovante_storage_path: string | null
          conciliado: boolean | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          entidade_id: string | null
          entidade_nome: string | null
          entidade_tipo: string | null
          forma_pagamento: string | null
          forma_pagamento_prevista: string | null
          fornecedor_id: string | null
          id: string
          juros_previsto: number
          juros_real: number
          loja_id: string | null
          notas: string | null
          numero_parcela: number | null
          origem_pagamento_id: string | null
          pedido_id: string | null
          recorrente: boolean | null
          status: string | null
          taxa_perc: number | null
          tipo: string
          total_parcelas: number | null
          updated_at: string
          valor: number
        }
        Insert: {
          adendo_pedido_id?: string | null
          agrupado?: boolean
          aprovacao_motivo?: string | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          baixado_em?: string | null
          baixado_por?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          comprovante_storage_path?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_nome?: string | null
          entidade_tipo?: string | null
          forma_pagamento?: string | null
          forma_pagamento_prevista?: string | null
          fornecedor_id?: string | null
          id?: string
          juros_previsto?: number
          juros_real?: number
          loja_id?: string | null
          notas?: string | null
          numero_parcela?: number | null
          origem_pagamento_id?: string | null
          pedido_id?: string | null
          recorrente?: boolean | null
          status?: string | null
          taxa_perc?: number | null
          tipo: string
          total_parcelas?: number | null
          updated_at?: string
          valor: number
        }
        Update: {
          adendo_pedido_id?: string | null
          agrupado?: boolean
          aprovacao_motivo?: string | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          baixado_em?: string | null
          baixado_por?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          comprovante_storage_path?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          entidade_id?: string | null
          entidade_nome?: string | null
          entidade_tipo?: string | null
          forma_pagamento?: string | null
          forma_pagamento_prevista?: string | null
          fornecedor_id?: string | null
          id?: string
          juros_previsto?: number
          juros_real?: number
          loja_id?: string | null
          notas?: string | null
          numero_parcela?: number | null
          origem_pagamento_id?: string | null
          pedido_id?: string | null
          recorrente?: boolean | null
          status?: string | null
          taxa_perc?: number | null
          tipo?: string
          total_parcelas?: number | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_financeiros_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          arquivado: boolean
          cliente_id: string | null
          created_at: string
          crm_estagio_id: string | null
          data_apresentacao: string | null
          endereco: string | null
          hora_apresentacao: string | null
          id: string
          indicador: string | null
          interesse: string[] | null
          loja_id: string | null
          motivo_perda: string | null
          nome: string
          notas: string | null
          orcamento_id: string | null
          responsavel_id: string | null
          status: string
          updated_at: string
          usuario_id: string | null
          whatsapp: string
        }
        Insert: {
          arquivado?: boolean
          cliente_id?: string | null
          created_at?: string
          crm_estagio_id?: string | null
          data_apresentacao?: string | null
          endereco?: string | null
          hora_apresentacao?: string | null
          id?: string
          indicador?: string | null
          interesse?: string[] | null
          loja_id?: string | null
          motivo_perda?: string | null
          nome: string
          notas?: string | null
          orcamento_id?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string | null
          whatsapp: string
        }
        Update: {
          arquivado?: boolean
          cliente_id?: string | null
          created_at?: string
          crm_estagio_id?: string | null
          data_apresentacao?: string | null
          endereco?: string | null
          hora_apresentacao?: string | null
          id?: string
          indicador?: string | null
          interesse?: string[] | null
          loja_id?: string | null
          motivo_perda?: string | null
          nome?: string
          notas?: string | null
          orcamento_id?: string | null
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_crm_estagio_id_fkey"
            columns: ["crm_estagio_id"]
            isOneToOne: false
            referencedRelation: "crm_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativo: boolean | null
          base_cliente_id: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          sigla: string | null
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          base_cliente_id?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          sigla?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          base_cliente_id?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          sigla?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lote_pedidos: {
        Row: {
          created_at: string
          data_inclusao: string
          etapa_atual: string | null
          id: string
          lote_id: string
          pedido_id: string
          posicao_ordem: number | null
        }
        Insert: {
          created_at?: string
          data_inclusao?: string
          etapa_atual?: string | null
          id?: string
          lote_id: string
          pedido_id: string
          posicao_ordem?: number | null
        }
        Update: {
          created_at?: string
          data_inclusao?: string
          etapa_atual?: string | null
          id?: string
          lote_id?: string
          pedido_id?: string
          posicao_ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lote_pedidos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_pedidos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_producao: {
        Row: {
          created_at: string
          created_by: string | null
          data_criacao: string
          data_previsao_conclusao: string | null
          descricao: string | null
          id: string
          loja_id: string | null
          numero_lote: string
          responsavel_id: string | null
          status_lote: Database["public"]["Enums"]["status_lote_producao"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_criacao?: string
          data_previsao_conclusao?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          numero_lote: string
          responsavel_id?: string | null
          status_lote?: Database["public"]["Enums"]["status_lote_producao"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_criacao?: string
          data_previsao_conclusao?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          numero_lote?: string
          responsavel_id?: string | null
          status_lote?: Database["public"]["Enums"]["status_lote_producao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_producao_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_assistencia: {
        Row: {
          assistencia_id: string
          created_at: string
          descricao: string
          disponivel: boolean | null
          id: string
          origem: string | null
          quantidade: number | null
        }
        Insert: {
          assistencia_id: string
          created_at?: string
          descricao: string
          disponivel?: boolean | null
          id?: string
          origem?: string | null
          quantidade?: number | null
        }
        Update: {
          assistencia_id?: string
          created_at?: string
          descricao?: string
          disponivel?: boolean | null
          id?: string
          origem?: string | null
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "materiais_assistencia_assistencia_id_fkey"
            columns: ["assistencia_id"]
            isOneToOne: false
            referencedRelation: "assistencias"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_vendas: {
        Row: {
          ano: number
          created_at: string
          id: string
          loja_id: string
          mes: number
          meta_valor: number
          meta_valor_2: number
          meta_valor_3: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          loja_id: string
          mes: number
          meta_valor?: number
          meta_valor_2?: number
          meta_valor_3?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          loja_id?: string
          mes?: number
          meta_valor?: number
          meta_valor_2?: number
          meta_valor_3?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: []
      }
      metodos_pagamento: {
        Row: {
          agrupado: boolean
          ativo: boolean | null
          created_at: string
          id: string
          juros_modo: string
          max_parcelas: number
          nome: string
          parcelas_config: Json
          prazo_recebimento_dias: number
          taxa_perc_parcela: number
        }
        Insert: {
          agrupado?: boolean
          ativo?: boolean | null
          created_at?: string
          id?: string
          juros_modo?: string
          max_parcelas?: number
          nome: string
          parcelas_config?: Json
          prazo_recebimento_dias?: number
          taxa_perc_parcela?: number
        }
        Update: {
          agrupado?: boolean
          ativo?: boolean | null
          created_at?: string
          id?: string
          juros_modo?: string
          max_parcelas?: number
          nome?: string
          parcelas_config?: Json
          prazo_recebimento_dias?: number
          taxa_perc_parcela?: number
        }
        Relationships: []
      }
      modulos_loja: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          contratado: boolean
          created_at: string
          data_ativacao: string | null
          data_desativacao: string | null
          id: string
          loja_id: string
          modulo_chave: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          contratado?: boolean
          created_at?: string
          data_ativacao?: string | null
          data_desativacao?: string | null
          id?: string
          loja_id: string
          modulo_chave: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          contratado?: boolean
          created_at?: string
          data_ativacao?: string | null
          data_desativacao?: string | null
          id?: string
          loja_id?: string
          modulo_chave?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulos_loja_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      modulos_sistema: {
        Row: {
          ativo_global: boolean
          categoria: string | null
          chave: string
          created_at: string
          descricao: string | null
          essencial: boolean
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo_global?: boolean
          categoria?: string | null
          chave: string
          created_at?: string
          descricao?: string | null
          essencial?: boolean
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo_global?: boolean
          categoria?: string | null
          chave?: string
          created_at?: string
          descricao?: string | null
          essencial?: boolean
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          ambiente: string | null
          atualizado_por: string | null
          chave: string | null
          chave_acesso: string | null
          cliente_id: string | null
          codigo_retorno: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          danfe_storage_path: string | null
          danfe_url: string | null
          data_autorizacao: string | null
          data_cancelamento: string | null
          data_emissao: string | null
          digest_value: string | null
          id: string
          loja_id: string | null
          mensagem_retorno: string | null
          modelo: string | null
          motivo_rejeicao: string | null
          natureza_operacao: string | null
          numero: string | null
          numero_lote: string | null
          numero_nf: number | null
          numero_recibo: string | null
          pdf_storage_path: string | null
          pedido_id: string | null
          protocolo: string | null
          protocolo_autorizacao: string | null
          provider: string | null
          provider_id: string | null
          retorno_sefaz_url: string | null
          serie: string | null
          status: string
          tipo: string
          updated_at: string
          valor_impostos: number | null
          valor_produtos: number | null
          valor_servicos: number | null
          valor_total: number
          xml_autorizado_url: string | null
          xml_storage_path: string | null
          xml_url: string | null
        }
        Insert: {
          ambiente?: string | null
          atualizado_por?: string | null
          chave?: string | null
          chave_acesso?: string | null
          cliente_id?: string | null
          codigo_retorno?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          danfe_storage_path?: string | null
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          digest_value?: string | null
          id?: string
          loja_id?: string | null
          mensagem_retorno?: string | null
          modelo?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero?: string | null
          numero_lote?: string | null
          numero_nf?: number | null
          numero_recibo?: string | null
          pdf_storage_path?: string | null
          pedido_id?: string | null
          protocolo?: string | null
          protocolo_autorizacao?: string | null
          provider?: string | null
          provider_id?: string | null
          retorno_sefaz_url?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_impostos?: number | null
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number
          xml_autorizado_url?: string | null
          xml_storage_path?: string | null
          xml_url?: string | null
        }
        Update: {
          ambiente?: string | null
          atualizado_por?: string | null
          chave?: string | null
          chave_acesso?: string | null
          cliente_id?: string | null
          codigo_retorno?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          danfe_storage_path?: string | null
          danfe_url?: string | null
          data_autorizacao?: string | null
          data_cancelamento?: string | null
          data_emissao?: string | null
          digest_value?: string | null
          id?: string
          loja_id?: string | null
          mensagem_retorno?: string | null
          modelo?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero?: string | null
          numero_lote?: string | null
          numero_nf?: number | null
          numero_recibo?: string | null
          pdf_storage_path?: string | null
          pedido_id?: string | null
          protocolo?: string | null
          protocolo_autorizacao?: string | null
          provider?: string | null
          provider_id?: string | null
          retorno_sefaz_url?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_impostos?: number | null
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number
          xml_autorizado_url?: string | null
          xml_storage_path?: string | null
          xml_url?: string | null
        }
        Relationships: []
      }
      notas_fiscais_eventos: {
        Row: {
          codigo_retorno: string | null
          created_at: string
          criado_por: string | null
          id: string
          mensagem: string | null
          nota_fiscal_id: string
          protocolo: string | null
          status_anterior: string | null
          status_novo: string | null
          tipo_evento: string
          xml_evento_storage_path: string | null
        }
        Insert: {
          codigo_retorno?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          mensagem?: string | null
          nota_fiscal_id: string
          protocolo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento: string
          xml_evento_storage_path?: string | null
        }
        Update: {
          codigo_retorno?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          mensagem?: string | null
          nota_fiscal_id?: string
          protocolo?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo_evento?: string
          xml_evento_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_eventos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_itens: {
        Row: {
          aliquota: number | null
          cfop: string | null
          created_at: string
          csosn: string | null
          cst: string | null
          descricao: string
          id: string
          ncm: string | null
          nota_fiscal_id: string
          produto_fiscal_id: string | null
          quantidade: number
          servico_fiscal_id: string | null
          tipo_item: string
          unidade: string | null
          valor_imposto: number | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aliquota?: number | null
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst?: string | null
          descricao: string
          id?: string
          ncm?: string | null
          nota_fiscal_id: string
          produto_fiscal_id?: string | null
          quantidade?: number
          servico_fiscal_id?: string | null
          tipo_item: string
          unidade?: string | null
          valor_imposto?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          aliquota?: number | null
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst?: string | null
          descricao?: string
          id?: string
          ncm?: string | null
          nota_fiscal_id?: string
          produto_fiscal_id?: string | null
          quantidade?: number
          servico_fiscal_id?: string | null
          tipo_item?: string
          unidade?: string | null
          valor_imposto?: number | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_itens_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_produto_fiscal_id_fkey"
            columns: ["produto_fiscal_id"]
            isOneToOne: false
            referencedRelation: "produtos_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_itens_servico_fiscal_id_fkey"
            columns: ["servico_fiscal_id"]
            isOneToOne: false
            referencedRelation: "servicos_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais_logs_tecnicos: {
        Row: {
          created_at: string
          duracao_ms: number | null
          erro: string | null
          etapa: string
          id: string
          loja_id: string | null
          nota_fiscal_id: string
          payload_resumido: Json | null
          retorno_resumido: Json | null
        }
        Insert: {
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          etapa: string
          id?: string
          loja_id?: string | null
          nota_fiscal_id: string
          payload_resumido?: Json | null
          retorno_resumido?: Json | null
        }
        Update: {
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          etapa?: string
          id?: string
          loja_id?: string | null
          nota_fiscal_id?: string
          payload_resumido?: Json | null
          retorno_resumido?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_logs_tecnicos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string | null
          metadata: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string | null
          metadata?: Json | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string | null
          metadata?: Json | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      ocorrencias: {
        Row: {
          cliente_id: string | null
          codigo: string | null
          created_at: string
          descricao: string | null
          foto_url: string | null
          id: string
          loja_id: string | null
          pedido_id: string | null
          prazo_resolucao: string | null
          prioridade: string | null
          responsavel_id: string | null
          status: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          foto_url?: string | null
          id?: string
          loja_id?: string | null
          pedido_id?: string | null
          prazo_resolucao?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          foto_url?: string | null
          id?: string
          loja_id?: string | null
          pedido_id?: string | null
          prazo_resolucao?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocorrencias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocorrencias_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_documentos: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mime_type: string | null
          nome: string
          orcamento_id: string
          origem: string | null
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          orcamento_id: string
          origem?: string | null
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          nome?: string
          orcamento_id?: string
          origem?: string | null
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_documentos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          adendo_descricao: string | null
          adendo_tipo: string | null
          cliente_final: string | null
          cliente_id: string | null
          codigo: string
          confirmado_em: string | null
          consultor_id: string | null
          created_at: string
          created_by: string | null
          desconto_perc: number | null
          desconto_valor: number | null
          estagio_id: string | null
          id: string
          is_adendo: boolean | null
          is_complemento: boolean
          loja_id: string | null
          motivo_perda: string | null
          nome_projeto: string | null
          origem_id: string | null
          parceiro_id: string | null
          parceiro_perc: number | null
          pedido_origem_complemento_id: string | null
          pedido_origem_id: string | null
          perdido_em: string | null
          projetista_id: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          adendo_descricao?: string | null
          adendo_tipo?: string | null
          cliente_final?: string | null
          cliente_id?: string | null
          codigo: string
          confirmado_em?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          desconto_perc?: number | null
          desconto_valor?: number | null
          estagio_id?: string | null
          id?: string
          is_adendo?: boolean | null
          is_complemento?: boolean
          loja_id?: string | null
          motivo_perda?: string | null
          nome_projeto?: string | null
          origem_id?: string | null
          parceiro_id?: string | null
          parceiro_perc?: number | null
          pedido_origem_complemento_id?: string | null
          pedido_origem_id?: string | null
          perdido_em?: string | null
          projetista_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          adendo_descricao?: string | null
          adendo_tipo?: string | null
          cliente_final?: string | null
          cliente_id?: string | null
          codigo?: string
          confirmado_em?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          desconto_perc?: number | null
          desconto_valor?: number | null
          estagio_id?: string | null
          id?: string
          is_adendo?: boolean | null
          is_complemento?: boolean
          loja_id?: string | null
          motivo_perda?: string | null
          nome_projeto?: string | null
          origem_id?: string | null
          parceiro_id?: string | null
          parceiro_perc?: number | null
          pedido_origem_complemento_id?: string | null
          pedido_origem_id?: string | null
          perdido_em?: string | null
          projetista_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "crm_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "origens_lead"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      origens_lead: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      pagamentos_orcamento: {
        Row: {
          created_at: string
          data_vencimento: string | null
          id: string
          metodo: string
          orcamento_id: string
          parcelas: number | null
          parcelas_detalhe: Json | null
          parcelas_formas: Json | null
          parcelas_vencimentos: Json | null
          valor: number
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          id?: string
          metodo: string
          orcamento_id: string
          parcelas?: number | null
          parcelas_detalhe?: Json | null
          parcelas_formas?: Json | null
          parcelas_vencimentos?: Json | null
          valor: number
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          id?: string
          metodo?: string
          orcamento_id?: string
          parcelas?: number | null
          parcelas_detalhe?: Json | null
          parcelas_formas?: Json | null
          parcelas_vencimentos?: Json | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_orcamento_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_comissoes: {
        Row: {
          cliente_id: string | null
          contrato_numero: string | null
          created_at: string
          data_pagamento: string | null
          id: string
          lancamento_id: string | null
          loja_id: string | null
          observacoes: string | null
          orcamento_id: string | null
          parceiro_id: string
          pedido_id: string | null
          percentual: number | null
          repassado: boolean
          status: string
          updated_at: string
          valor_base: number | null
          valor_calculado: number
          valor_corrigido: number | null
        }
        Insert: {
          cliente_id?: string | null
          contrato_numero?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          lancamento_id?: string | null
          loja_id?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          parceiro_id: string
          pedido_id?: string | null
          percentual?: number | null
          repassado?: boolean
          status?: string
          updated_at?: string
          valor_base?: number | null
          valor_calculado?: number
          valor_corrigido?: number | null
        }
        Update: {
          cliente_id?: string | null
          contrato_numero?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          lancamento_id?: string | null
          loja_id?: string | null
          observacoes?: string | null
          orcamento_id?: string | null
          parceiro_id?: string
          pedido_id?: string | null
          percentual?: number | null
          repassado?: boolean
          status?: string
          updated_at?: string
          valor_base?: number | null
          valor_calculado?: number
          valor_corrigido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_comissoes_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_financeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_comissoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_comissoes_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_comissoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_comprovantes: {
        Row: {
          comissao_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          nome: string
          parceiro_id: string | null
          storage_path: string
          tamanho: number | null
          uploaded_by: string | null
        }
        Insert: {
          comissao_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome: string
          parceiro_id?: string | null
          storage_path: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Update: {
          comissao_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome?: string
          parceiro_id?: string | null
          storage_path?: string
          tamanho?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_comprovantes_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "parceiro_comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_comprovantes_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_pedidos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          loja_id: string | null
          origem: string | null
          parceiro_id: string
          pedido_id: string | null
          status: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          loja_id?: string | null
          origem?: string | null
          parceiro_id: string
          pedido_id?: string | null
          status?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          loja_id?: string | null
          origem?: string | null
          parceiro_id?: string
          pedido_id?: string | null
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_pedidos_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_pedidos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros: {
        Row: {
          ativo: boolean | null
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          id: string
          loja_id: string | null
          nome: string
          observacoes: string | null
          percentual_padrao: number | null
          telefone: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          observacoes?: string | null
          percentual_padrao?: number | null
          telefone?: string | null
          tipo?: string
        }
        Update: {
          ativo?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          observacoes?: string | null
          percentual_padrao?: number | null
          telefone?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_chat: {
        Row: {
          created_at: string
          id: string
          mencionados: string[] | null
          mensagem: string
          pedido_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mencionados?: string[] | null
          mensagem: string
          pedido_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mencionados?: string[] | null
          mensagem?: string
          pedido_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_chat_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_comissao_divisoes: {
        Row: {
          created_at: string
          id: string
          papel: string
          pedido_id: string
          percentual: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          papel?: string
          pedido_id: string
          percentual?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          papel?: string
          pedido_id?: string
          percentual?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_comissao_divisoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_documentos: {
        Row: {
          assinado_em: string | null
          assinatura_cpf: string | null
          assinatura_data_url: string | null
          assinatura_nome: string | null
          ativo: boolean
          bucket_name: string
          categoria_projeto: string | null
          created_at: string
          created_by: string | null
          enviado_para_assinatura: boolean | null
          id: string
          mime_type: string | null
          nome: string
          pasta_id: string | null
          pedido_id: string
          signing_token: string | null
          solicitacao_id: string | null
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          assinado_em?: string | null
          assinatura_cpf?: string | null
          assinatura_data_url?: string | null
          assinatura_nome?: string | null
          ativo?: boolean
          bucket_name?: string
          categoria_projeto?: string | null
          created_at?: string
          created_by?: string | null
          enviado_para_assinatura?: boolean | null
          id?: string
          mime_type?: string | null
          nome: string
          pasta_id?: string | null
          pedido_id: string
          signing_token?: string | null
          solicitacao_id?: string | null
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          assinado_em?: string | null
          assinatura_cpf?: string | null
          assinatura_data_url?: string | null
          assinatura_nome?: string | null
          ativo?: boolean
          bucket_name?: string
          categoria_projeto?: string | null
          created_at?: string
          created_by?: string | null
          enviado_para_assinatura?: boolean | null
          id?: string
          mime_type?: string | null
          nome?: string
          pasta_id?: string | null
          pedido_id?: string
          signing_token?: string | null
          solicitacao_id?: string | null
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_documentos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "pedido_pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_documentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_estagio_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          created_at: string
          descricao: string
          estagio_id: string | null
          id: string
          ordem: number
          pedido_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          descricao: string
          estagio_id?: string | null
          id?: string
          ordem?: number
          pedido_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          descricao?: string
          estagio_id?: string | null
          id?: string
          ordem?: number
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_estagio_checklist_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_estagio_checklist_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_estagio_historico: {
        Row: {
          created_at: string
          estagio_anterior_id: string | null
          estagio_id: string | null
          id: string
          observacao: string | null
          pedido_id: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          estagio_anterior_id?: string | null
          estagio_id?: string | null
          id?: string
          observacao?: string | null
          pedido_id: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          estagio_anterior_id?: string | null
          estagio_id?: string | null
          id?: string
          observacao?: string | null
          pedido_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_estagio_historico_estagio_anterior_id_fkey"
            columns: ["estagio_anterior_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_estagio_historico_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_estagio_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_etapa_fabrica: {
        Row: {
          created_at: string
          data_entrada: string
          data_saida: string | null
          etapa_chave: string
          id: string
          lote_id: string | null
          movido_por: string | null
          observacao: string | null
          pedido_id: string
          responsavel_id: string | null
        }
        Insert: {
          created_at?: string
          data_entrada?: string
          data_saida?: string | null
          etapa_chave: string
          id?: string
          lote_id?: string | null
          movido_por?: string | null
          observacao?: string | null
          pedido_id: string
          responsavel_id?: string | null
        }
        Update: {
          created_at?: string
          data_entrada?: string
          data_saida?: string | null
          etapa_chave?: string
          id?: string
          lote_id?: string | null
          movido_por?: string | null
          observacao?: string | null
          pedido_id?: string
          responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_etapa_fabrica_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "lotes_producao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_etapa_fabrica_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_etiquetas: {
        Row: {
          created_at: string
          etiqueta_id: string
          pedido_id: string
        }
        Insert: {
          created_at?: string
          etiqueta_id: string
          pedido_id: string
        }
        Update: {
          created_at?: string
          etiqueta_id?: string
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_etiquetas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "etiquetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_etiquetas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens_avulsos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          negociavel: boolean
          nome: string
          orcamento_id: string | null
          ordem: number | null
          pedido_id: string | null
          preco_custo_unit: number
          produto_id: string | null
          quantidade: number
          valor_venda: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          negociavel?: boolean
          nome: string
          orcamento_id?: string | null
          ordem?: number | null
          pedido_id?: string | null
          preco_custo_unit?: number
          produto_id?: string | null
          quantidade?: number
          valor_venda?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          negociavel?: boolean
          nome?: string
          orcamento_id?: string | null
          ordem?: number | null
          pedido_id?: string | null
          preco_custo_unit?: number
          produto_id?: string | null
          quantidade?: number
          valor_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_avulsos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_pastas: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number | null
          pedido_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number | null
          pedido_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number | null
          pedido_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_pastas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_revisoes: {
        Row: {
          ambiente_id: string
          aprovada: boolean | null
          aprovada_em: string | null
          created_at: string
          created_by: string | null
          diff: Json | null
          id: string
          parsed_data: Json | null
          pedido_id: string
          raw_content: string | null
          valor_original: number | null
          valor_revisado: number | null
          variacao_perc: number | null
          versao: number
        }
        Insert: {
          ambiente_id: string
          aprovada?: boolean | null
          aprovada_em?: string | null
          created_at?: string
          created_by?: string | null
          diff?: Json | null
          id?: string
          parsed_data?: Json | null
          pedido_id: string
          raw_content?: string | null
          valor_original?: number | null
          valor_revisado?: number | null
          variacao_perc?: number | null
          versao?: number
        }
        Update: {
          ambiente_id?: string
          aprovada?: boolean | null
          aprovada_em?: string | null
          created_at?: string
          created_by?: string | null
          diff?: Json | null
          id?: string
          parsed_data?: Json | null
          pedido_id?: string
          raw_content?: string | null
          valor_original?: number | null
          valor_revisado?: number | null
          variacao_perc?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_revisoes_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_revisoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          adendo_descricao: string | null
          adendo_tipo: string | null
          arquivado: boolean | null
          cliente_final: string | null
          cliente_id: string
          codigo: string
          created_at: string
          critico: boolean | null
          data_assinatura_pdf_final: string | null
          data_chegada_material: string | null
          data_entrega: string | null
          data_envio_fabrica: string | null
          data_limite_entrega: string | null
          data_limite_finalizacao: string | null
          data_limite_inicio_montagem: string | null
          data_medicao_tecnica: string | null
          data_montagem: string | null
          data_pagamento_fabrica: string | null
          data_vistoria: string | null
          entregador_id: string | null
          estagio_fabrica_id: string | null
          estagio_iniciado_em: string | null
          estagio_montagem_id: string | null
          estagio_operacional_id: string | null
          estagio_pos_venda_id: string | null
          estagio_prazo: string | null
          estagio_responsavel_id: string | null
          estagio_revisao_id: string | null
          estrelas: number | null
          etapa_atual: string | null
          fabrica_expedido_em: string | null
          fabrica_expedido_por: string | null
          id: string
          is_adendo: boolean | null
          is_complemento: boolean
          juros_total: number
          loja_id: string | null
          montador_id: string | null
          observacoes_venda: string | null
          orcamento_id: string | null
          pedido_origem_complemento_id: string | null
          pedido_pai_id: string | null
          previsao_medicao: string | null
          projetista_id: string | null
          receita_codigo: string | null
          rt_repassado: number
          status: string
          status_fabrica: string | null
          status_fabrica_anterior: string | null
          updated_at: string
          urgencia: Database["public"]["Enums"]["urgencia_nivel"] | null
          valor_liquido: number | null
          valor_total: number | null
          vip: boolean | null
          workflow_estagio: string | null
          workflow_iniciado_em: string | null
        }
        Insert: {
          adendo_descricao?: string | null
          adendo_tipo?: string | null
          arquivado?: boolean | null
          cliente_final?: string | null
          cliente_id: string
          codigo: string
          created_at?: string
          critico?: boolean | null
          data_assinatura_pdf_final?: string | null
          data_chegada_material?: string | null
          data_entrega?: string | null
          data_envio_fabrica?: string | null
          data_limite_entrega?: string | null
          data_limite_finalizacao?: string | null
          data_limite_inicio_montagem?: string | null
          data_medicao_tecnica?: string | null
          data_montagem?: string | null
          data_pagamento_fabrica?: string | null
          data_vistoria?: string | null
          entregador_id?: string | null
          estagio_fabrica_id?: string | null
          estagio_iniciado_em?: string | null
          estagio_montagem_id?: string | null
          estagio_operacional_id?: string | null
          estagio_pos_venda_id?: string | null
          estagio_prazo?: string | null
          estagio_responsavel_id?: string | null
          estagio_revisao_id?: string | null
          estrelas?: number | null
          etapa_atual?: string | null
          fabrica_expedido_em?: string | null
          fabrica_expedido_por?: string | null
          id?: string
          is_adendo?: boolean | null
          is_complemento?: boolean
          juros_total?: number
          loja_id?: string | null
          montador_id?: string | null
          observacoes_venda?: string | null
          orcamento_id?: string | null
          pedido_origem_complemento_id?: string | null
          pedido_pai_id?: string | null
          previsao_medicao?: string | null
          projetista_id?: string | null
          receita_codigo?: string | null
          rt_repassado?: number
          status?: string
          status_fabrica?: string | null
          status_fabrica_anterior?: string | null
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_nivel"] | null
          valor_liquido?: number | null
          valor_total?: number | null
          vip?: boolean | null
          workflow_estagio?: string | null
          workflow_iniciado_em?: string | null
        }
        Update: {
          adendo_descricao?: string | null
          adendo_tipo?: string | null
          arquivado?: boolean | null
          cliente_final?: string | null
          cliente_id?: string
          codigo?: string
          created_at?: string
          critico?: boolean | null
          data_assinatura_pdf_final?: string | null
          data_chegada_material?: string | null
          data_entrega?: string | null
          data_envio_fabrica?: string | null
          data_limite_entrega?: string | null
          data_limite_finalizacao?: string | null
          data_limite_inicio_montagem?: string | null
          data_medicao_tecnica?: string | null
          data_montagem?: string | null
          data_pagamento_fabrica?: string | null
          data_vistoria?: string | null
          entregador_id?: string | null
          estagio_fabrica_id?: string | null
          estagio_iniciado_em?: string | null
          estagio_montagem_id?: string | null
          estagio_operacional_id?: string | null
          estagio_pos_venda_id?: string | null
          estagio_prazo?: string | null
          estagio_responsavel_id?: string | null
          estagio_revisao_id?: string | null
          estrelas?: number | null
          etapa_atual?: string | null
          fabrica_expedido_em?: string | null
          fabrica_expedido_por?: string | null
          id?: string
          is_adendo?: boolean | null
          is_complemento?: boolean
          juros_total?: number
          loja_id?: string | null
          montador_id?: string | null
          observacoes_venda?: string | null
          orcamento_id?: string | null
          pedido_origem_complemento_id?: string | null
          pedido_pai_id?: string | null
          previsao_medicao?: string | null
          projetista_id?: string | null
          receita_codigo?: string | null
          rt_repassado?: number
          status?: string
          status_fabrica?: string | null
          status_fabrica_anterior?: string | null
          updated_at?: string
          urgencia?: Database["public"]["Enums"]["urgencia_nivel"] | null
          valor_liquido?: number | null
          valor_total?: number | null
          vip?: boolean | null
          workflow_estagio?: string | null
          workflow_iniciado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_estagio_fabrica_id_fkey"
            columns: ["estagio_fabrica_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_estagio_montagem_id_fkey"
            columns: ["estagio_montagem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_estagio_operacional_id_fkey"
            columns: ["estagio_operacional_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_estagio_pos_venda_id_fkey"
            columns: ["estagio_pos_venda_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_estagio_revisao_id_fkey"
            columns: ["estagio_revisao_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      permissoes: {
        Row: {
          acao: string
          created_at: string
          id: string
          modulo: string
          perfil: string | null
          user_id: string
        }
        Insert: {
          acao?: string
          created_at?: string
          id?: string
          modulo: string
          perfil?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          modulo?: string
          perfil?: string | null
          user_id?: string
        }
        Relationships: []
      }
      permissoes_modulos_catalogo: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          grupo: string | null
          id: string
          modulo: string
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          grupo?: string | null
          id?: string
          modulo: string
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          grupo?: string | null
          id?: string
          modulo?: string
        }
        Relationships: []
      }
      pipeline_automacoes: {
        Row: {
          acao: string
          acao_config: Json
          ajustar_prazo_dias: number | null
          ativo: boolean
          condicao_tipo: string
          condicao_valor: string | null
          created_at: string
          dias: number | null
          estagio_destino_id: string
          estagio_origem_id: string
          evento: string
          id: string
          ordem: number
          pipeline: string
          pipeline_destino: string | null
          updated_at: string
        }
        Insert: {
          acao?: string
          acao_config?: Json
          ajustar_prazo_dias?: number | null
          ativo?: boolean
          condicao_tipo?: string
          condicao_valor?: string | null
          created_at?: string
          dias?: number | null
          estagio_destino_id: string
          estagio_origem_id: string
          evento: string
          id?: string
          ordem?: number
          pipeline: string
          pipeline_destino?: string | null
          updated_at?: string
        }
        Update: {
          acao?: string
          acao_config?: Json
          ajustar_prazo_dias?: number | null
          ativo?: boolean
          condicao_tipo?: string
          condicao_valor?: string | null
          created_at?: string
          dias?: number | null
          estagio_destino_id?: string
          estagio_origem_id?: string
          evento?: string
          id?: string
          ordem?: number
          pipeline?: string
          pipeline_destino?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_automacoes_estagio_destino_id_fkey"
            columns: ["estagio_destino_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_automacoes_estagio_origem_id_fkey"
            columns: ["estagio_origem_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_estagios: {
        Row: {
          ativo: boolean | null
          checklist_template_id: string | null
          concluir_acao: string
          concluir_estagio_destino_id: string | null
          concluir_pipeline_destino: string | null
          cor: string | null
          created_at: string
          criar_card_em: string[]
          id: string
          nome: string
          ordem: number
          pipeline: string
          sla_dias_uteis: number | null
        }
        Insert: {
          ativo?: boolean | null
          checklist_template_id?: string | null
          concluir_acao?: string
          concluir_estagio_destino_id?: string | null
          concluir_pipeline_destino?: string | null
          cor?: string | null
          created_at?: string
          criar_card_em?: string[]
          id?: string
          nome: string
          ordem?: number
          pipeline: string
          sla_dias_uteis?: number | null
        }
        Update: {
          ativo?: boolean | null
          checklist_template_id?: string | null
          concluir_acao?: string
          concluir_estagio_destino_id?: string | null
          concluir_pipeline_destino?: string | null
          cor?: string | null
          created_at?: string
          criar_card_em?: string[]
          id?: string
          nome?: string
          ordem?: number
          pipeline?: string
          sla_dias_uteis?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_estagios_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_estagios_concluir_estagio_destino_id_fkey"
            columns: ["concluir_estagio_destino_id"]
            isOneToOne: false
            referencedRelation: "pipeline_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      politica_juros: {
        Row: {
          ativo: boolean
          created_at: string
          faixa_max: number
          faixa_min: number
          id: string
          loja_id: string | null
          perc_mes: number
          responsavel: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          faixa_max?: number
          faixa_min?: number
          id?: string
          loja_id?: string | null
          perc_mes?: number
          responsavel?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          faixa_max?: number
          faixa_min?: number
          id?: string
          loja_id?: string | null
          perc_mes?: number
          responsavel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "politica_juros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          codigo_barra: string | null
          codigo_interno: string | null
          created_at: string
          descricao: string
          fornecedor_id: string | null
          id: string
          loja_id: string | null
          preco_custo: number
          preco_venda: number
          quantidade: number
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo_barra?: string | null
          codigo_interno?: string | null
          created_at?: string
          descricao: string
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          preco_custo?: number
          preco_venda?: number
          quantidade?: number
          unidade_medida: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo_barra?: string | null
          codigo_interno?: string | null
          created_at?: string
          descricao?: string
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          preco_custo?: number
          preco_venda?: number
          quantidade?: number
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_fiscais: {
        Row: {
          aliquota_cofins: number | null
          aliquota_icms: number | null
          aliquota_ipi: number | null
          aliquota_pis: number | null
          ativo: boolean
          cest: string | null
          cfop_padrao: string | null
          created_at: string
          csosn: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_ipi: string | null
          cst_pis: string | null
          descricao: string | null
          id: string
          loja_id: string | null
          ncm: string | null
          nome: string
          origem_mercadoria: number | null
          unidade_comercial: string | null
          unidade_tributavel: string | null
          updated_at: string
        }
        Insert: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          ativo?: boolean
          cest?: string | null
          cfop_padrao?: string | null
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          ncm?: string | null
          nome: string
          origem_mercadoria?: number | null
          unidade_comercial?: string | null
          unidade_tributavel?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_cofins?: number | null
          aliquota_icms?: number | null
          aliquota_ipi?: number | null
          aliquota_pis?: number | null
          ativo?: boolean
          cest?: string | null
          cfop_padrao?: string | null
          created_at?: string
          csosn?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_ipi?: string | null
          cst_pis?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          ncm?: string | null
          nome?: string
          origem_mercadoria?: number | null
          unidade_comercial?: string | null
          unidade_tributavel?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_fiscais_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          base_cliente_id: string | null
          bloqueado_em: string | null
          cargo_saas: string | null
          convite_enviado_em: string | null
          created_at: string
          data_nascimento: string | null
          desconto_max_perc: number | null
          id: string
          loja_id: string | null
          nome_completo: string | null
          observacoes_saas: string | null
          status_saas: string
          telefone: string | null
          tipo_usuario: string
          ultimo_acesso: string | null
          updated_at: string
          user_id: string
          usuario_saas_ativo: boolean
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          base_cliente_id?: string | null
          bloqueado_em?: string | null
          cargo_saas?: string | null
          convite_enviado_em?: string | null
          created_at?: string
          data_nascimento?: string | null
          desconto_max_perc?: number | null
          id?: string
          loja_id?: string | null
          nome_completo?: string | null
          observacoes_saas?: string | null
          status_saas?: string
          telefone?: string | null
          tipo_usuario?: string
          ultimo_acesso?: string | null
          updated_at?: string
          user_id: string
          usuario_saas_ativo?: boolean
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          base_cliente_id?: string | null
          bloqueado_em?: string | null
          cargo_saas?: string | null
          convite_enviado_em?: string | null
          created_at?: string
          data_nascimento?: string | null
          desconto_max_perc?: number | null
          id?: string
          loja_id?: string | null
          nome_completo?: string | null
          observacoes_saas?: string | null
          status_saas?: string
          telefone?: string | null
          tipo_usuario?: string
          ultimo_acesso?: string | null
          updated_at?: string
          user_id?: string
          usuario_saas_ativo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      promob_imports: {
        Row: {
          ambiente_id: string | null
          created_at: string
          created_by: string | null
          id: string
          orcamento_id: string | null
          parsed_data: Json | null
          raw_content: string | null
        }
        Insert: {
          ambiente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          orcamento_id?: string | null
          parsed_data?: Json | null
          raw_content?: string | null
        }
        Update: {
          ambiente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          orcamento_id?: string | null
          parsed_data?: Json | null
          raw_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promob_imports_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promob_imports_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_aprovacao: {
        Row: {
          ativo: boolean | null
          created_at: string
          desconto_max_perc: number
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          desconto_max_perc?: number
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          desconto_max_perc?: number
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      regras_comissao: {
        Row: {
          comissao_percentual: number
          created_at: string
          id: string
          loja_id: string | null
          meta_minima: number
          modo: string
          premiacao_step_a_partir_de: number
          premiacao_step_tamanho: number
          premiacao_step_valor: number
          premiacao_tiers: Json
          updated_at: string
        }
        Insert: {
          comissao_percentual?: number
          created_at?: string
          id?: string
          loja_id?: string | null
          meta_minima?: number
          modo?: string
          premiacao_step_a_partir_de?: number
          premiacao_step_tamanho?: number
          premiacao_step_valor?: number
          premiacao_tiers?: Json
          updated_at?: string
        }
        Update: {
          comissao_percentual?: number
          created_at?: string
          id?: string
          loja_id?: string | null
          meta_minima?: number
          modo?: string
          premiacao_step_a_partir_de?: number
          premiacao_step_tamanho?: number
          premiacao_step_valor?: number
          premiacao_tiers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regras_comissao_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: true
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      resultado_pedido_ajustes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          created_at: string
          custo_revisao_ajustado: number | null
          id: string
          loja_id: string | null
          pedido_id: string
          valor_venda_liquida_ajustado: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          created_at?: string
          custo_revisao_ajustado?: number | null
          id?: string
          loja_id?: string | null
          pedido_id: string
          valor_venda_liquida_ajustado?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          created_at?: string
          custo_revisao_ajustado?: number | null
          id?: string
          loja_id?: string | null
          pedido_id?: string
          valor_venda_liquida_ajustado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "resultado_pedido_ajustes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resultado_pedido_ajustes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: true
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_cargos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          pode_receber_tarefas: boolean
          pode_ser_responsavel_pedido: boolean
          protegido_sistema: boolean
          setor_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          pode_receber_tarefas?: boolean
          pode_ser_responsavel_pedido?: boolean
          protegido_sistema?: boolean
          setor_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          pode_receber_tarefas?: boolean
          pode_ser_responsavel_pedido?: boolean
          protegido_sistema?: boolean
          setor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_cargos_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "rh_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_documentos: {
        Row: {
          created_at: string
          funcionario_id: string
          id: string
          nome_arquivo: string | null
          observacoes: string | null
          tipo: string
          url: string
        }
        Insert: {
          created_at?: string
          funcionario_id: string
          id?: string
          nome_arquivo?: string | null
          observacoes?: string | null
          tipo: string
          url: string
        }
        Update: {
          created_at?: string
          funcionario_id?: string
          id?: string
          nome_arquivo?: string | null
          observacoes?: string | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "rh_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_ferias: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          funcionario_id: string
          id: string
          observacoes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          funcionario_id: string
          id?: string
          observacoes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "rh_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_funcionarios: {
        Row: {
          cargo_id: string | null
          cpf: string | null
          created_at: string
          data_admissao: string | null
          data_desligamento: string | null
          data_fim_contrato: string | null
          data_fim_experiencia: string | null
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          loja_id: string | null
          nome_completo: string
          observacoes: string | null
          rg: string | null
          salario: number | null
          setor_id: string | null
          status: string
          telefone: string | null
          tipo_contrato: string
          turno_id: string | null
          updated_at: string
        }
        Insert: {
          cargo_id?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_desligamento?: string | null
          data_fim_contrato?: string | null
          data_fim_experiencia?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          loja_id?: string | null
          nome_completo: string
          observacoes?: string | null
          rg?: string | null
          salario?: number | null
          setor_id?: string | null
          status?: string
          telefone?: string | null
          tipo_contrato?: string
          turno_id?: string | null
          updated_at?: string
        }
        Update: {
          cargo_id?: string | null
          cpf?: string | null
          created_at?: string
          data_admissao?: string | null
          data_desligamento?: string | null
          data_fim_contrato?: string | null
          data_fim_experiencia?: string | null
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          loja_id?: string | null
          nome_completo?: string
          observacoes?: string | null
          rg?: string | null
          salario?: number | null
          setor_id?: string | null
          status?: string
          telefone?: string | null
          tipo_contrato?: string
          turno_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_funcionarios_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "rh_setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_funcionarios_turno_id_fkey"
            columns: ["turno_id"]
            isOneToOne: false
            referencedRelation: "rh_turnos"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_ocorrencias: {
        Row: {
          anexo_url: string | null
          created_at: string
          data: string
          descricao: string | null
          funcionario_id: string
          id: string
          responsavel: string | null
          tipo: string
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          funcionario_id: string
          id?: string
          responsavel?: string | null
          tipo: string
        }
        Update: {
          anexo_url?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          funcionario_id?: string
          id?: string
          responsavel?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_ocorrencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "rh_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_pontos: {
        Row: {
          atraso_min: number
          created_at: string
          data: string
          funcionario_id: string
          id: string
          latitude: number | null
          longitude: number | null
          marcado_em: string
          observacoes: string | null
          origem: string
          selfie_url: string | null
          tipo: string
        }
        Insert: {
          atraso_min?: number
          created_at?: string
          data?: string
          funcionario_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          marcado_em?: string
          observacoes?: string | null
          origem?: string
          selfie_url?: string | null
          tipo: string
        }
        Update: {
          atraso_min?: number
          created_at?: string
          data?: string
          funcionario_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          marcado_em?: string
          observacoes?: string | null
          origem?: string
          selfie_url?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_pontos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "rh_funcionarios"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_setores: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      rh_turnos: {
        Row: {
          created_at: string
          dias_semana: number[]
          hora_entrada: string
          hora_saida: string
          hora_saida_almoco: string | null
          hora_volta_almoco: string | null
          horarios_por_dia: Json
          id: string
          nome: string
          observacoes: string | null
          tolerancia_min: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_semana?: number[]
          hora_entrada: string
          hora_saida: string
          hora_saida_almoco?: string | null
          hora_volta_almoco?: string | null
          horarios_por_dia?: Json
          id?: string
          nome: string
          observacoes?: string | null
          tolerancia_min?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_semana?: number[]
          hora_entrada?: string
          hora_saida?: string
          hora_saida_almoco?: string | null
          hora_volta_almoco?: string | null
          horarios_por_dia?: Json
          id?: string
          nome?: string
          observacoes?: string | null
          tolerancia_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      rh_zonas_ponto: {
        Row: {
          cargo_id: string | null
          created_at: string
          funcionario_id: string | null
          id: string
          latitude: number
          longitude: number
          nome: string
          raio_metros: number
          setor_id: string | null
        }
        Insert: {
          cargo_id?: string | null
          created_at?: string
          funcionario_id?: string | null
          id?: string
          latitude: number
          longitude: number
          nome: string
          raio_metros?: number
          setor_id?: string | null
        }
        Update: {
          cargo_id?: string | null
          created_at?: string
          funcionario_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          nome?: string
          raio_metros?: number
          setor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rh_zonas_ponto_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_zonas_ponto_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "rh_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rh_zonas_ponto_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "rh_setores"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissoes: {
        Row: {
          acao: string
          created_at: string
          id: string
          modulo: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          acao?: string
          created_at?: string
          id?: string
          modulo: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          modulo?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      saas_agenda_eventos: {
        Row: {
          atualizado_por: string | null
          base_cliente_id: string | null
          created_at: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          link_reuniao: string | null
          local: string | null
          observacoes: string | null
          oportunidade_id: string | null
          participantes: string | null
          responsavel_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          base_cliente_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          id?: string
          link_reuniao?: string | null
          local?: string | null
          observacoes?: string | null
          oportunidade_id?: string | null
          participantes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          base_cliente_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          link_reuniao?: string | null
          local?: string | null
          observacoes?: string | null
          oportunidade_id?: string | null
          participantes?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_agenda_eventos_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_agenda_eventos_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "saas_crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_categorias_financeiras: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          contabilizar_dre: boolean
          created_at: string
          criado_por: string | null
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          contabilizar_dre?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          contabilizar_dre?: boolean
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_categorias_financeiras_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "saas_categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_centros_custo: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      saas_contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean
          atualizado_por: string | null
          banco: string | null
          chave_pix: string | null
          conta: string | null
          created_at: string
          criado_por: string | null
          id: string
          nome: string
          observacoes: string | null
          saldo_inicial: number
          tipo_conta: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          atualizado_por?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          saldo_inicial?: number
          tipo_conta?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          atualizado_por?: string | null
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          saldo_inicial?: number
          tipo_conta?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saas_crm_historico: {
        Row: {
          created_at: string
          criado_por: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          oportunidade_id: string
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          oportunidade_id: string
          tipo_evento: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          oportunidade_id?: string
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_crm_historico_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "saas_crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_crm_oportunidades: {
        Row: {
          armazenamento_previsto_gb: number | null
          atualizado_por: string | null
          base_cliente_id: string | null
          cnpj: string | null
          created_at: string
          criado_por: string | null
          data_fechamento: string | null
          data_prevista_fechamento: string | null
          email: string | null
          etapa: string
          id: string
          lojas_previstas: number | null
          motivo_perda: string | null
          nome_empresa: string
          nome_fantasia: string | null
          observacoes: string | null
          origem: string | null
          plano_interesse: string | null
          probabilidade: number | null
          razao_social: string | null
          responsavel_nome: string | null
          sistema_saas_id: string | null
          status: string
          telefone: string | null
          updated_at: string
          usuarios_previstos: number | null
          valor_implantacao_proposto: number | null
          valor_mensal_proposto: number | null
        }
        Insert: {
          armazenamento_previsto_gb?: number | null
          atualizado_por?: string | null
          base_cliente_id?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por?: string | null
          data_fechamento?: string | null
          data_prevista_fechamento?: string | null
          email?: string | null
          etapa?: string
          id?: string
          lojas_previstas?: number | null
          motivo_perda?: string | null
          nome_empresa: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          plano_interesse?: string | null
          probabilidade?: number | null
          razao_social?: string | null
          responsavel_nome?: string | null
          sistema_saas_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          usuarios_previstos?: number | null
          valor_implantacao_proposto?: number | null
          valor_mensal_proposto?: number | null
        }
        Update: {
          armazenamento_previsto_gb?: number | null
          atualizado_por?: string | null
          base_cliente_id?: string | null
          cnpj?: string | null
          created_at?: string
          criado_por?: string | null
          data_fechamento?: string | null
          data_prevista_fechamento?: string | null
          email?: string | null
          etapa?: string
          id?: string
          lojas_previstas?: number | null
          motivo_perda?: string | null
          nome_empresa?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          origem?: string | null
          plano_interesse?: string | null
          probabilidade?: number | null
          razao_social?: string | null
          responsavel_nome?: string | null
          sistema_saas_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          usuarios_previstos?: number | null
          valor_implantacao_proposto?: number | null
          valor_mensal_proposto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saas_crm_oportunidades_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_crm_oportunidades_sistema_saas_id_fkey"
            columns: ["sistema_saas_id"]
            isOneToOne: false
            referencedRelation: "sistemas_saas"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saas_lancamentos_financeiros: {
        Row: {
          atualizado_por: string | null
          base_cliente_id: string | null
          categoria_id: string | null
          centro_custo_id: string | null
          cobranca_id: string | null
          compra_avulsa_id: string | null
          conta_bancaria_id: string | null
          contrato_id: string | null
          created_at: string
          criado_por: string | null
          data_competencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          forma_pagamento_prevista: string | null
          forma_pagamento_real: string | null
          fornecedor_nome: string | null
          id: string
          nota_fiscal_id: string | null
          observacoes: string | null
          origem: string
          sistema_saas_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          atualizado_por?: string | null
          base_cliente_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cobranca_id?: string | null
          compra_avulsa_id?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento_prevista?: string | null
          forma_pagamento_real?: string | null
          fornecedor_nome?: string | null
          id?: string
          nota_fiscal_id?: string | null
          observacoes?: string | null
          origem?: string
          sistema_saas_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor?: number
        }
        Update: {
          atualizado_por?: string | null
          base_cliente_id?: string | null
          categoria_id?: string | null
          centro_custo_id?: string | null
          cobranca_id?: string | null
          compra_avulsa_id?: string | null
          conta_bancaria_id?: string | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_competencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento_prevista?: string | null
          forma_pagamento_real?: string | null
          fornecedor_nome?: string | null
          id?: string
          nota_fiscal_id?: string | null
          observacoes?: string | null
          origem?: string
          sistema_saas_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "saas_lancamentos_financeiros_base_cliente_id_fkey"
            columns: ["base_cliente_id"]
            isOneToOne: false
            referencedRelation: "bases_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "saas_categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_centro_custo_id_fkey"
            columns: ["centro_custo_id"]
            isOneToOne: false
            referencedRelation: "saas_centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "base_cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_compra_avulsa_id_fkey"
            columns: ["compra_avulsa_id"]
            isOneToOne: false
            referencedRelation: "base_compras_avulsas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "saas_contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "base_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_lancamentos_financeiros_sistema_saas_id_fkey"
            columns: ["sistema_saas_id"]
            isOneToOne: false
            referencedRelation: "sistemas_saas"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_usuarios_historico: {
        Row: {
          created_at: string
          criado_por: string | null
          dados: Json | null
          descricao: string | null
          evento: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          dados?: Json | null
          descricao?: string | null
          evento: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          dados?: Json | null
          descricao?: string | null
          evento?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      servicos_fiscais: {
        Row: {
          aliquota_iss: number | null
          ativo: boolean
          cnae: string | null
          codigo_lc116: string | null
          codigo_servico_municipal: string | null
          created_at: string
          descricao: string | null
          id: string
          iss_retido: boolean
          loja_id: string | null
          municipio_incidencia: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          aliquota_iss?: number | null
          ativo?: boolean
          cnae?: string | null
          codigo_lc116?: string | null
          codigo_servico_municipal?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          iss_retido?: boolean
          loja_id?: string | null
          municipio_incidencia?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          aliquota_iss?: number | null
          ativo?: boolean
          cnae?: string | null
          codigo_lc116?: string | null
          codigo_servico_municipal?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          iss_retido?: boolean
          loja_id?: string | null
          municipio_incidencia?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_fiscais_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      sistemas_saas: {
        Row: {
          ativo: boolean
          atualizado_por: string | null
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          ordem: number
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atualizado_por?: string | null
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      solicitacoes_assinatura: {
        Row: {
          arquivo_contrato_manual_url: string | null
          assinado_manual_em: string | null
          assinado_manual_por: string | null
          assinado_manualmente_por: string | null
          assinatura_cliente_url: string | null
          assinatura_loja_url: string | null
          cancelado_em: string | null
          cliente_assinado_em: string | null
          cliente_documento: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_ip: string | null
          cliente_localizacao: Json | null
          cliente_nome: string | null
          cliente_telefone: string | null
          cliente_user_agent: string | null
          concluido_em: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_assinatura_manual: string | null
          doc_foto_url: string | null
          documento_cliente_manual_url: string | null
          expira_em: string
          file_name: string | null
          file_url: string | null
          final_pdf_storage_path: string | null
          final_pdf_url: string | null
          id: string
          loja_assinado_em: string | null
          loja_assinatura_cargo: string | null
          loja_assinatura_email: string | null
          loja_assinatura_nome: string | null
          loja_id: string | null
          loja_ip: string | null
          loja_user_agent: string | null
          metodo_assinatura: string | null
          motivo_recusa: string | null
          observacao: string | null
          observacao_manual: string | null
          pedido_documento_id: string | null
          pedido_id: string
          recusado_em: string | null
          responsavel_interno_id: string | null
          selfie_url: string | null
          status: Database["public"]["Enums"]["assinatura_status"]
          storage_path: string | null
          tipo_documento_id: string
          token: string
          updated_at: string
        }
        Insert: {
          arquivo_contrato_manual_url?: string | null
          assinado_manual_em?: string | null
          assinado_manual_por?: string | null
          assinado_manualmente_por?: string | null
          assinatura_cliente_url?: string | null
          assinatura_loja_url?: string | null
          cancelado_em?: string | null
          cliente_assinado_em?: string | null
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_ip?: string | null
          cliente_localizacao?: Json | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          cliente_user_agent?: string | null
          concluido_em?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura_manual?: string | null
          doc_foto_url?: string | null
          documento_cliente_manual_url?: string | null
          expira_em?: string
          file_name?: string | null
          file_url?: string | null
          final_pdf_storage_path?: string | null
          final_pdf_url?: string | null
          id?: string
          loja_assinado_em?: string | null
          loja_assinatura_cargo?: string | null
          loja_assinatura_email?: string | null
          loja_assinatura_nome?: string | null
          loja_id?: string | null
          loja_ip?: string | null
          loja_user_agent?: string | null
          metodo_assinatura?: string | null
          motivo_recusa?: string | null
          observacao?: string | null
          observacao_manual?: string | null
          pedido_documento_id?: string | null
          pedido_id: string
          recusado_em?: string | null
          responsavel_interno_id?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["assinatura_status"]
          storage_path?: string | null
          tipo_documento_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          arquivo_contrato_manual_url?: string | null
          assinado_manual_em?: string | null
          assinado_manual_por?: string | null
          assinado_manualmente_por?: string | null
          assinatura_cliente_url?: string | null
          assinatura_loja_url?: string | null
          cancelado_em?: string | null
          cliente_assinado_em?: string | null
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_ip?: string | null
          cliente_localizacao?: Json | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          cliente_user_agent?: string | null
          concluido_em?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura_manual?: string | null
          doc_foto_url?: string | null
          documento_cliente_manual_url?: string | null
          expira_em?: string
          file_name?: string | null
          file_url?: string | null
          final_pdf_storage_path?: string | null
          final_pdf_url?: string | null
          id?: string
          loja_assinado_em?: string | null
          loja_assinatura_cargo?: string | null
          loja_assinatura_email?: string | null
          loja_assinatura_nome?: string | null
          loja_id?: string | null
          loja_ip?: string | null
          loja_user_agent?: string | null
          metodo_assinatura?: string | null
          motivo_recusa?: string | null
          observacao?: string | null
          observacao_manual?: string | null
          pedido_documento_id?: string | null
          pedido_id?: string
          recusado_em?: string | null
          responsavel_interno_id?: string | null
          selfie_url?: string | null
          status?: Database["public"]["Enums"]["assinatura_status"]
          storage_path?: string | null
          tipo_documento_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_assinatura_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_assinatura_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_assinatura_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_assinatura_pedido_documento_id_fkey"
            columns: ["pedido_documento_id"]
            isOneToOne: false
            referencedRelation: "pedido_documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_assinatura_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_assinatura_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_itens_ambiente: {
        Row: {
          altura: number | null
          ambiente_id: string
          categoria: string | null
          codigo: string | null
          cor: string | null
          created_at: string
          custo_cliente: number | null
          custo_fabrica: number | null
          custo_loja: number | null
          descricao: string
          id: string
          largura: number | null
          profundidade: number | null
          quantidade: number | null
        }
        Insert: {
          altura?: number | null
          ambiente_id: string
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string
          custo_cliente?: number | null
          custo_fabrica?: number | null
          custo_loja?: number | null
          descricao: string
          id?: string
          largura?: number | null
          profundidade?: number | null
          quantidade?: number | null
        }
        Update: {
          altura?: number | null
          ambiente_id?: string
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string
          custo_cliente?: number | null
          custo_fabrica?: number | null
          custo_loja?: number | null
          descricao?: string
          id?: string
          largura?: number | null
          profundidade?: number | null
          quantidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sub_itens_ambiente_ambiente_id_fkey"
            columns: ["ambiente_id"]
            isOneToOne: false
            referencedRelation: "ambientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_nativas_modelos: {
        Row: {
          ativo: boolean
          bloquear_proxima: boolean
          cargo_id: string | null
          conclui_por_upload_categoria: string | null
          created_at: string
          depende_de: string | null
          descricao: string | null
          exibir_controle_prazos: boolean
          exibir_kanban: boolean
          exibir_meus_chamados: boolean
          exige_anexo: boolean
          exige_aprovacao: boolean
          fonte_responsavel: string | null
          gatilho: string
          gatilho_offset_dias: number
          gatilho_offset_direcao: string
          gatilho_referencia: string | null
          id: string
          loja_id: string | null
          nome: string
          ordem: number
          pipeline: string | null
          prazo_qtd: number
          prazo_tipo: string
          prazo_unidade: string
          pre_alerta_dias: number
          prioridade: string
          responsavel_padrao_id: string | null
          setor: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bloquear_proxima?: boolean
          cargo_id?: string | null
          conclui_por_upload_categoria?: string | null
          created_at?: string
          depende_de?: string | null
          descricao?: string | null
          exibir_controle_prazos?: boolean
          exibir_kanban?: boolean
          exibir_meus_chamados?: boolean
          exige_anexo?: boolean
          exige_aprovacao?: boolean
          fonte_responsavel?: string | null
          gatilho: string
          gatilho_offset_dias?: number
          gatilho_offset_direcao?: string
          gatilho_referencia?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          ordem?: number
          pipeline?: string | null
          prazo_qtd?: number
          prazo_tipo?: string
          prazo_unidade?: string
          pre_alerta_dias?: number
          prioridade?: string
          responsavel_padrao_id?: string | null
          setor?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bloquear_proxima?: boolean
          cargo_id?: string | null
          conclui_por_upload_categoria?: string | null
          created_at?: string
          depende_de?: string | null
          descricao?: string | null
          exibir_controle_prazos?: boolean
          exibir_kanban?: boolean
          exibir_meus_chamados?: boolean
          exige_anexo?: boolean
          exige_aprovacao?: boolean
          fonte_responsavel?: string | null
          gatilho?: string
          gatilho_offset_dias?: number
          gatilho_offset_direcao?: string
          gatilho_referencia?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          ordem?: number
          pipeline?: string | null
          prazo_qtd?: number
          prazo_tipo?: string
          prazo_unidade?: string
          pre_alerta_dias?: number
          prioridade?: string
          responsavel_padrao_id?: string | null
          setor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_nativas_modelos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_nativas_modelos_depende_de_fkey"
            columns: ["depende_de"]
            isOneToOne: false
            referencedRelation: "tarefas_nativas_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_nativas_modelos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_nativas_modelos_responsavel_padrao_id_fkey"
            columns: ["responsavel_padrao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_pedido: {
        Row: {
          bloqueio_proxima: boolean
          cargo_id: string | null
          cliente_id: string | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          criado_por: string | null
          depende_de: string | null
          descricao: string | null
          exibir_controle_prazos: boolean
          exibir_kanban: boolean
          exibir_meus_chamados: boolean
          exige_anexo: boolean
          exige_aprovacao: boolean
          id: string
          kanban_card_id: string | null
          loja_id: string | null
          modelo_id: string | null
          observacao_conclusao: string | null
          origem: string
          pedido_id: string
          prazo: string | null
          pre_alerta_em: string | null
          prioridade: string
          responsavel_id: string | null
          setor: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          bloqueio_proxima?: boolean
          cargo_id?: string | null
          cliente_id?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          criado_por?: string | null
          depende_de?: string | null
          descricao?: string | null
          exibir_controle_prazos?: boolean
          exibir_kanban?: boolean
          exibir_meus_chamados?: boolean
          exige_anexo?: boolean
          exige_aprovacao?: boolean
          id?: string
          kanban_card_id?: string | null
          loja_id?: string | null
          modelo_id?: string | null
          observacao_conclusao?: string | null
          origem?: string
          pedido_id: string
          prazo?: string | null
          pre_alerta_em?: string | null
          prioridade?: string
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          bloqueio_proxima?: boolean
          cargo_id?: string | null
          cliente_id?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          criado_por?: string | null
          depende_de?: string | null
          descricao?: string | null
          exibir_controle_prazos?: boolean
          exibir_kanban?: boolean
          exibir_meus_chamados?: boolean
          exige_anexo?: boolean
          exige_aprovacao?: boolean
          id?: string
          kanban_card_id?: string | null
          loja_id?: string | null
          modelo_id?: string | null
          observacao_conclusao?: string | null
          origem?: string
          pedido_id?: string
          prazo?: string | null
          pre_alerta_em?: string | null
          prioridade?: string
          responsavel_id?: string | null
          setor?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_pedido_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "rh_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_depende_de_fkey"
            columns: ["depende_de"]
            isOneToOne: false
            referencedRelation: "tarefas_pedido"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_kanban_card_id_fkey"
            columns: ["kanban_card_id"]
            isOneToOne: false
            referencedRelation: "kanban_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "tarefas_nativas_modelos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_pedido_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      templates_mensagem: {
        Row: {
          ativo: boolean | null
          canal: string
          conteudo: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          canal?: string
          conteudo: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          canal?: string
          conteudo?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      timeline_eventos: {
        Row: {
          created_at: string
          descricao: string | null
          entidade_id: string
          entidade_tipo: string
          id: string
          metadata: Json | null
          tipo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          metadata?: Json | null
          tipo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          metadata?: Json | null
          tipo?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      tipos_documento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          origem: Database["public"]["Enums"]["documento_origem_tipo"]
          requer_assinatura_cliente: boolean
          requer_assinatura_loja: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          origem: Database["public"]["Enums"]["documento_origem_tipo"]
          requer_assinatura_cliente?: boolean
          requer_assinatura_loja?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          origem?: Database["public"]["Enums"]["documento_origem_tipo"]
          requer_assinatura_cliente?: boolean
          requer_assinatura_loja?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_lojas: {
        Row: {
          created_at: string
          loja_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          loja_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          loja_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lojas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_my_permissions: {
        Row: {
          acao: string | null
          modulo: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_business_days: {
        Args: { p_base: string; p_days: number }
        Returns: string
      }
      add_dias_uteis: {
        Args: { _inicio: string; _loja: string; _n: number }
        Returns: string
      }
      atualizar_etapa_atual_pedido: {
        Args: { p_pedido_id: string }
        Returns: string
      }
      auto_criar_solic_contrato: {
        Args: { p_contrato_id?: string; p_pedido_id: string }
        Returns: string
      }
      avaliar_condicao_automacao: {
        Args: {
          _card_id: string
          _contexto?: Json
          _pedido_id: string
          _regra_id: string
        }
        Returns: boolean
      }
      checklist_estagio_concluido: {
        Args: { _estagio_id: string; _pedido_id: string }
        Returns: boolean
      }
      concluir_kanban_card: { Args: { _card_id: string }; Returns: undefined }
      contrato_has_active_anon_solic: {
        Args: { _contrato_id: string }
        Returns: boolean
      }
      criar_solic_assinatura_documento: {
        Args: {
          p_dias_validade?: number
          p_pedido_documento_id: string
          p_pedido_id: string
          p_tipo_slug?: string
        }
        Returns: string
      }
      current_loja_id: { Args: never; Returns: string }
      ensure_fluxo_projeto_final_producao_e_fabrica: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      ensure_fluxo_revisao_e_pdf_final: {
        Args: { p_pedido_id: string }
        Returns: Json
      }
      ensure_participants_for_solicitation: {
        Args: { p_solic: string }
        Returns: undefined
      }
      ensure_tarefas_cronograma_pedido: {
        Args: { p_pedido_id: string }
        Returns: Json
      }
      executar_automacao_acao: {
        Args: {
          _card_id: string
          _contexto?: Json
          _evento: string
          _pedido_id: string
          _regra_id: string
        }
        Returns: Json
      }
      fn_concluir_tarefas_por_assinatura: {
        Args: { p_pedido_id: string }
        Returns: number
      }
      fn_current_user_email: { Args: never; Returns: string }
      fn_dedupe_projeto_final: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      fn_garantir_pasta_projeto: {
        Args: { p_pedido_id: string }
        Returns: string
      }
      fn_instanciar_tarefas_nativas: {
        Args: { p_gatilho: string; p_pedido_id: string }
        Returns: number
      }
      fn_resolver_responsavel_tarefa: {
        Args: { p_fonte: string; p_pedido_id: string }
        Returns: string
      }
      garantir_participante: {
        Args: {
          p_solic: string
          p_tipo: Database["public"]["Enums"]["assinatura_participante_tipo"]
        }
        Returns: {
          assinado_em: string | null
          cargo: string | null
          created_at: string
          documento: string | null
          email: string | null
          enviado_em: string | null
          id: string
          ip: string | null
          nome: string | null
          solicitacao_id: string
          status: string
          telefone: string | null
          tipo: Database["public"]["Enums"]["assinatura_participante_tipo"]
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
          visualizado_em: string | null
        }
        SetofOptions: {
          from: "*"
          to: "assinatura_participantes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gerar_receber_de_pedido_assinado: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      has_permission: {
        Args: { _acao?: string; _modulo: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dia_util: { Args: { _data: string; _loja: string }; Returns: boolean }
      is_rh_manager: { Args: { _uid: string }; Returns: boolean }
      kanban_processar_atrasos: { Args: never; Returns: number }
      liberar_pedido_para_fabrica: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      loja_de_ambiente: { Args: { _ambiente_id: string }; Returns: string }
      loja_de_assistencia: {
        Args: { _assistencia_id: string }
        Returns: string
      }
      loja_de_comissao: { Args: { _comissao_id: string }; Returns: string }
      loja_de_orcamento: { Args: { _orcamento_id: string }; Returns: string }
      loja_de_parceiro: { Args: { _parceiro_id: string }; Returns: string }
      loja_de_pedido: { Args: { _pedido_id: string }; Returns: string }
      modulo_ativo: {
        Args: { _chave: string; _loja_id: string }
        Returns: boolean
      }
      pedido_doc_anon_writeable: {
        Args: { _pedido_id: string; _solic_id: string }
        Returns: boolean
      }
      pipeline_avancar_card:
        | {
            Args: { _contexto?: Json; _evento: string; _pedido_id: string }
            Returns: number
          }
        | {
            Args: {
              _contexto?: Json
              _evento: string
              _pedido_id: string
              _simular?: boolean
            }
            Returns: Json
          }
      pipeline_simular: {
        Args: {
          _contexto?: Json
          _estagio_origem_id: string
          _evento: string
          _loja?: string
        }
        Returns: Json
      }
      pode_acessar_loja: { Args: { _loja_id: string }; Returns: boolean }
      pode_autorizar_excecao_agenda: {
        Args: { _loja: string; _user_id: string }
        Returns: boolean
      }
      proximo_numero_lote: {
        Args: { _ano?: number; _loja_id: string }
        Returns: string
      }
      recalcular_prazos_operacionais_pedido: {
        Args: { p_pedido_id: string }
        Returns: undefined
      }
      recalcular_status_solicitacao: {
        Args: { p_solic: string }
        Returns: undefined
      }
      registrar_assinatura_manual: {
        Args: {
          p_contrato_path: string
          p_contrato_url: string
          p_doc_cliente_path?: string
          p_doc_cliente_url?: string
          p_observacao?: string
          p_solic: string
        }
        Returns: undefined
      }
      revisao_avancar_preparo_pj_final: {
        Args: { _pedido_id: string; _revisao_data: string }
        Returns: undefined
      }
      rh_cargo_em_uso: { Args: { p_cargo_id: string }; Returns: boolean }
      solic_anon_writeable: { Args: { _solic_id: string }; Returns: boolean }
      solic_belongs_to_validated_contrato: {
        Args: { _solic_id: string }
        Returns: boolean
      }
      sub_dias_uteis: {
        Args: { _inicio: string; _loja: string; _n: number }
        Returns: string
      }
      sync_pedido_para_kanban_card: {
        Args: { _estagio_id: string; _pedido_id: string; _pipeline: string }
        Returns: undefined
      }
      transferir_responsabilidades_usuario: {
        Args: {
          p_motivo?: string
          p_transferir_agenda?: boolean
          p_transferir_chamados?: boolean
          p_transferir_clientes?: boolean
          p_transferir_kanban?: boolean
          p_transferir_pedidos?: boolean
          p_transferir_tarefas?: boolean
          p_usuario_antigo: string
          p_usuario_novo: string
        }
        Returns: Json
      }
      user_has_perm: {
        Args: { _acao: string; _modulo: string; _user_id: string }
        Returns: boolean
      }
      user_pode_acessar_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agenda_status:
        | "agendado"
        | "concluido"
        | "cancelado"
        | "reagendado"
        | "pendente_aprovacao"
      agenda_tipo:
        | "medicao_tecnica"
        | "revisao_final"
        | "entrega"
        | "montagem"
        | "assistencia_tecnica"
        | "tarefa_interna"
        | "apresentacao_comercial"
        | "retorno"
        | "medicao_orcamento"
      app_role:
        | "admin"
        | "vendedor"
        | "montador"
        | "diretor"
        | "gerente"
        | "projetista"
        | "financeiro"
        | "tecnico"
        | "assistencia"
      assinatura_participante_tipo: "cliente" | "loja"
      assinatura_status:
        | "rascunho"
        | "aguardando_cliente"
        | "assinado_cliente"
        | "aguardando_loja"
        | "assinado_loja"
        | "concluido"
        | "recusado"
        | "cancelado"
        | "expirado"
        | "assinado_manual"
      autorizacao_status: "pendente" | "aprovada" | "rejeitada" | "expirada"
      autorizacao_tipo:
        | "desconto_acima_limite"
        | "agenda_fora_horario"
        | "agenda_fora_dia"
        | "agenda_lead_time"
        | "outro"
        | "agenda_dia_nao_permitido"
        | "lead_time_abaixo_minimo"
        | "revisao_sem_diferenca_aguardando_aprovacao"
        | "revisao_com_diferenca_positiva"
        | "revisao_com_diferenca_negativa"
        | "revisao_adendo_pendente"
      categoria_autorizacao: "revisao" | "agenda" | "desconto" | "outro"
      documento_origem_tipo: "sistema" | "upload"
      status_lote_producao:
        | "rascunho"
        | "em_producao"
        | "concluido"
        | "cancelado"
      urgencia_nivel: "baixa" | "media" | "alta"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agenda_status: [
        "agendado",
        "concluido",
        "cancelado",
        "reagendado",
        "pendente_aprovacao",
      ],
      agenda_tipo: [
        "medicao_tecnica",
        "revisao_final",
        "entrega",
        "montagem",
        "assistencia_tecnica",
        "tarefa_interna",
        "apresentacao_comercial",
        "retorno",
        "medicao_orcamento",
      ],
      app_role: [
        "admin",
        "vendedor",
        "montador",
        "diretor",
        "gerente",
        "projetista",
        "financeiro",
        "tecnico",
        "assistencia",
      ],
      assinatura_participante_tipo: ["cliente", "loja"],
      assinatura_status: [
        "rascunho",
        "aguardando_cliente",
        "assinado_cliente",
        "aguardando_loja",
        "assinado_loja",
        "concluido",
        "recusado",
        "cancelado",
        "expirado",
        "assinado_manual",
      ],
      autorizacao_status: ["pendente", "aprovada", "rejeitada", "expirada"],
      autorizacao_tipo: [
        "desconto_acima_limite",
        "agenda_fora_horario",
        "agenda_fora_dia",
        "agenda_lead_time",
        "outro",
        "agenda_dia_nao_permitido",
        "lead_time_abaixo_minimo",
        "revisao_sem_diferenca_aguardando_aprovacao",
        "revisao_com_diferenca_positiva",
        "revisao_com_diferenca_negativa",
        "revisao_adendo_pendente",
      ],
      categoria_autorizacao: ["revisao", "agenda", "desconto", "outro"],
      documento_origem_tipo: ["sistema", "upload"],
      status_lote_producao: [
        "rascunho",
        "em_producao",
        "concluido",
        "cancelado",
      ],
      urgencia_nivel: ["baixa", "media", "alta"],
    },
  },
} as const
