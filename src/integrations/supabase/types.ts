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
      autorizacoes: {
        Row: {
          agenda_evento_id: string | null
          aprovador_email: string | null
          aprovador_id: string | null
          contexto: Json
          created_at: string
          decidido_em: string | null
          decisao_observacao: string | null
          descricao: string | null
          id: string
          limite_padrao: number | null
          loja_id: string | null
          orcamento_id: string | null
          pedido_id: string | null
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
          contexto?: Json
          created_at?: string
          decidido_em?: string | null
          decisao_observacao?: string | null
          descricao?: string | null
          id?: string
          limite_padrao?: number | null
          loja_id?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
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
          contexto?: Json
          created_at?: string
          decidido_em?: string | null
          decisao_observacao?: string | null
          descricao?: string | null
          id?: string
          limite_padrao?: number | null
          loja_id?: string | null
          orcamento_id?: string | null
          pedido_id?: string | null
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
          created_at: string
          id: string
          nome: string
          ordem: number | null
          parent_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number | null
          parent_id?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number | null
          parent_id?: string | null
          tipo?: string
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
      certificados_digitais: {
        Row: {
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          senha_encrypted: string | null
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          validade_fim: string | null
          validade_inicio: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          senha_encrypted?: string | null
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          senha_encrypted?: string | null
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          validade_fim?: string | null
          validade_inicio?: string | null
        }
        Relationships: []
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
      configuracoes_empresa: {
        Row: {
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
          estado: string | null
          id: string
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
          estado?: string | null
          id?: string
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
          estado?: string | null
          id?: string
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
          aprovacao_motivo: string | null
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          baixado_em: string | null
          baixado_por: string | null
          categoria_id: string | null
          comprovante_storage_path: string | null
          conciliado: boolean | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          forma_pagamento: string | null
          fornecedor_id: string | null
          id: string
          loja_id: string | null
          notas: string | null
          pedido_id: string | null
          recorrente: boolean | null
          status: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          adendo_pedido_id?: string | null
          aprovacao_motivo?: string | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          baixado_em?: string | null
          baixado_por?: string | null
          categoria_id?: string | null
          comprovante_storage_path?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          notas?: string | null
          pedido_id?: string | null
          recorrente?: boolean | null
          status?: string | null
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          adendo_pedido_id?: string | null
          aprovacao_motivo?: string | null
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          baixado_em?: string | null
          baixado_por?: string | null
          categoria_id?: string | null
          comprovante_storage_path?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          forma_pagamento?: string | null
          fornecedor_id?: string | null
          id?: string
          loja_id?: string | null
          notas?: string | null
          pedido_id?: string | null
          recorrente?: boolean | null
          status?: string | null
          tipo?: string
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
        Relationships: []
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
          taxa_perc_parcela?: number
        }
        Relationships: []
      }
      notas_fiscais: {
        Row: {
          chave: string | null
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data_emissao: string | null
          id: string
          loja_id: string | null
          motivo_rejeicao: string | null
          natureza_operacao: string | null
          numero: string | null
          pdf_storage_path: string | null
          pedido_id: string | null
          protocolo: string | null
          provider: string | null
          provider_id: string | null
          serie: string | null
          status: string
          tipo: string
          updated_at: string
          valor_produtos: number | null
          valor_servicos: number | null
          valor_total: number
          xml_storage_path: string | null
        }
        Insert: {
          chave?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          id?: string
          loja_id?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero?: string | null
          pdf_storage_path?: string | null
          pedido_id?: string | null
          protocolo?: string | null
          provider?: string | null
          provider_id?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number
          xml_storage_path?: string | null
        }
        Update: {
          chave?: string | null
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao?: string | null
          id?: string
          loja_id?: string | null
          motivo_rejeicao?: string | null
          natureza_operacao?: string | null
          numero?: string | null
          pdf_storage_path?: string | null
          pedido_id?: string | null
          protocolo?: string | null
          provider?: string | null
          provider_id?: string | null
          serie?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_produtos?: number | null
          valor_servicos?: number | null
          valor_total?: number
          xml_storage_path?: string | null
        }
        Relationships: []
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
          bucket_name: string
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
          bucket_name?: string
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
          bucket_name?: string
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
          data_chegada_material: string | null
          data_entrega: string | null
          data_envio_fabrica: string | null
          data_limite_finalizacao: string | null
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
          projetista_id: string | null
          receita_codigo: string | null
          rt_repassado: number
          status: string
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
          data_chegada_material?: string | null
          data_entrega?: string | null
          data_envio_fabrica?: string | null
          data_limite_finalizacao?: string | null
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
          projetista_id?: string | null
          receita_codigo?: string | null
          rt_repassado?: number
          status?: string
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
          data_chegada_material?: string | null
          data_entrega?: string | null
          data_envio_fabrica?: string | null
          data_limite_finalizacao?: string | null
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
          projetista_id?: string | null
          receita_codigo?: string | null
          rt_repassado?: number
          status?: string
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
      profiles: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          created_at: string
          data_nascimento: string | null
          desconto_max_perc: number | null
          id: string
          loja_id: string | null
          nome_completo: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          created_at?: string
          data_nascimento?: string | null
          desconto_max_perc?: number | null
          id?: string
          loja_id?: string | null
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          created_at?: string
          data_nascimento?: string | null
          desconto_max_perc?: number | null
          id?: string
          loja_id?: string | null
          nome_completo?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      rh_cargos: {
        Row: {
          created_at: string
          id: string
          nome: string
          setor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          setor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          setor_id?: string | null
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
      solicitacoes_assinatura: {
        Row: {
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
          doc_foto_url: string | null
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
          motivo_recusa: string | null
          observacao: string | null
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
          doc_foto_url?: string | null
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
          motivo_recusa?: string | null
          observacao?: string | null
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
          doc_foto_url?: string | null
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
          motivo_recusa?: string | null
          observacao?: string | null
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
      add_dias_uteis: {
        Args: { _inicio: string; _loja: string; _n: number }
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
      ensure_participants_for_solicitation: {
        Args: { p_solic: string }
        Returns: undefined
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
      kanban_processar_atrasos: { Args: never; Returns: number }
      loja_de_ambiente: { Args: { _ambiente_id: string }; Returns: string }
      loja_de_assistencia: {
        Args: { _assistencia_id: string }
        Returns: string
      }
      loja_de_comissao: { Args: { _comissao_id: string }; Returns: string }
      loja_de_orcamento: { Args: { _orcamento_id: string }; Returns: string }
      loja_de_parceiro: { Args: { _parceiro_id: string }; Returns: string }
      loja_de_pedido: { Args: { _pedido_id: string }; Returns: string }
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
      recalcular_status_solicitacao: {
        Args: { p_solic: string }
        Returns: undefined
      }
      revisao_avancar_preparo_pj_final: {
        Args: { _pedido_id: string; _revisao_data: string }
        Returns: undefined
      }
      sub_dias_uteis: {
        Args: { _fim: string; _loja: string; _n: number }
        Returns: string
      }
      sync_pedido_para_kanban_card: {
        Args: { _estagio_id: string; _pedido_id: string; _pipeline: string }
        Returns: undefined
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
      agenda_status: "agendado" | "concluido" | "cancelado" | "reagendado"
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
      documento_origem_tipo: "sistema" | "upload"
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
      agenda_status: ["agendado", "concluido", "cancelado", "reagendado"],
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
      ],
      documento_origem_tipo: ["sistema", "upload"],
      urgencia_nivel: ["baixa", "media", "alta"],
    },
  },
} as const
