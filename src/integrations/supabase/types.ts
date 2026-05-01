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
      ambientes: {
        Row: {
          created_at: string
          custo_aquisicao: number | null
          custo_fabrica: number | null
          custo_loja: number | null
          descricao: string | null
          id: string
          markup: number | null
          nome: string
          orcamento_id: string
          ordem: number | null
          prazo_dias: number | null
          preco_sugerido: number | null
        }
        Insert: {
          created_at?: string
          custo_aquisicao?: number | null
          custo_fabrica?: number | null
          custo_loja?: number | null
          descricao?: string | null
          id?: string
          markup?: number | null
          nome: string
          orcamento_id: string
          ordem?: number | null
          prazo_dias?: number | null
          preco_sugerido?: number | null
        }
        Update: {
          created_at?: string
          custo_aquisicao?: number | null
          custo_fabrica?: number | null
          custo_loja?: number | null
          descricao?: string | null
          id?: string
          markup?: number | null
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
      assistencias: {
        Row: {
          cliente_id: string | null
          codigo: string | null
          created_at: string
          data_agendamento: string | null
          descricao: string | null
          hora_agendamento: string | null
          id: string
          loja_id: string | null
          material_necessario: boolean | null
          observacoes: string | null
          pedido_id: string | null
          prioridade: string | null
          status: string | null
          tecnico_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          data_agendamento?: string | null
          descricao?: string | null
          hora_agendamento?: string | null
          id?: string
          loja_id?: string | null
          material_necessario?: boolean | null
          observacoes?: string | null
          pedido_id?: string | null
          prioridade?: string | null
          status?: string | null
          tecnico_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          codigo?: string | null
          created_at?: string
          data_agendamento?: string | null
          descricao?: string | null
          hora_agendamento?: string | null
          id?: string
          loja_id?: string | null
          material_necessario?: boolean | null
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
          telefone: string | null
          telefone_secundario: string | null
          updated_at: string
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
          telefone?: string | null
          telefone_secundario?: string | null
          updated_at?: string
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
          telefone?: string | null
          telefone_secundario?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_loja_id_fkey"
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
          created_at: string
          id: string
          nome: string
          saldo_inicial: number | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome: string
          saldo_inicial?: number | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco?: string | null
          conta?: string | null
          created_at?: string
          id?: string
          nome?: string
          saldo_inicial?: number | null
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
          id: string
          loja_id: string | null
          numero: string
          observacoes_adicionais: string | null
          orcamento_id: string
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
          id?: string
          loja_id?: string | null
          numero: string
          observacoes_adicionais?: string | null
          orcamento_id: string
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
          id?: string
          loja_id?: string | null
          numero?: string
          observacoes_adicionais?: string | null
          orcamento_id?: string
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
      lancamentos_financeiros: {
        Row: {
          categoria_id: string | null
          conciliado: boolean | null
          conta_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          id: string
          loja_id: string | null
          pedido_id: string | null
          recorrente: boolean | null
          status: string | null
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria_id?: string | null
          conciliado?: boolean | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
          pedido_id?: string | null
          recorrente?: boolean | null
          status?: string | null
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria_id?: string | null
          conciliado?: boolean | null
          conta_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          loja_id?: string | null
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
          created_at: string
          id: string
          indicador: string | null
          interesse: string[] | null
          loja_id: string | null
          nome: string
          notas: string | null
          status: string
          updated_at: string
          usuario_id: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicador?: string | null
          interesse?: string[] | null
          loja_id?: string | null
          nome: string
          notas?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string | null
          whatsapp: string
        }
        Update: {
          created_at?: string
          id?: string
          indicador?: string | null
          interesse?: string[] | null
          loja_id?: string | null
          nome?: string
          notas?: string | null
          status?: string
          updated_at?: string
          usuario_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativo: boolean | null
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
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
      metodos_pagamento: {
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
      orcamentos: {
        Row: {
          cliente_id: string | null
          codigo: string
          confirmado_em: string | null
          consultor_id: string | null
          created_at: string
          created_by: string | null
          desconto_perc: number | null
          desconto_valor: number | null
          id: string
          loja_id: string | null
          nome_projeto: string | null
          parceiro_id: string | null
          parceiro_perc: number | null
          projetista_id: string | null
          status: string
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          codigo: string
          confirmado_em?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          desconto_perc?: number | null
          desconto_valor?: number | null
          id?: string
          loja_id?: string | null
          nome_projeto?: string | null
          parceiro_id?: string | null
          parceiro_perc?: number | null
          projetista_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          codigo?: string
          confirmado_em?: string | null
          consultor_id?: string | null
          created_at?: string
          created_by?: string | null
          desconto_perc?: number | null
          desconto_valor?: number | null
          id?: string
          loja_id?: string | null
          nome_projeto?: string | null
          parceiro_id?: string | null
          parceiro_perc?: number | null
          projetista_id?: string | null
          status?: string
          subtotal?: number | null
          total?: number | null
          updated_at?: string
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
            foreignKeyName: "orcamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
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
          valor: number
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          id?: string
          metodo: string
          orcamento_id: string
          parcelas?: number | null
          valor: number
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          id?: string
          metodo?: string
          orcamento_id?: string
          parcelas?: number | null
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
      parceiros: {
        Row: {
          ativo: boolean | null
          created_at: string
          id: string
          loja_id: string | null
          nome: string
          percentual_padrao: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome: string
          percentual_padrao?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome?: string
          percentual_padrao?: number | null
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
        Relationships: []
      }
      pedido_documentos: {
        Row: {
          assinado_em: string | null
          assinatura_cpf: string | null
          assinatura_data_url: string | null
          assinatura_nome: string | null
          created_at: string
          created_by: string | null
          enviado_para_assinatura: boolean | null
          id: string
          mime_type: string | null
          nome: string
          pasta_id: string | null
          pedido_id: string
          signing_token: string | null
          storage_path: string
          tamanho: number | null
        }
        Insert: {
          assinado_em?: string | null
          assinatura_cpf?: string | null
          assinatura_data_url?: string | null
          assinatura_nome?: string | null
          created_at?: string
          created_by?: string | null
          enviado_para_assinatura?: boolean | null
          id?: string
          mime_type?: string | null
          nome: string
          pasta_id?: string | null
          pedido_id: string
          signing_token?: string | null
          storage_path: string
          tamanho?: number | null
        }
        Update: {
          assinado_em?: string | null
          assinatura_cpf?: string | null
          assinatura_data_url?: string | null
          assinatura_nome?: string | null
          created_at?: string
          created_by?: string | null
          enviado_para_assinatura?: boolean | null
          id?: string
          mime_type?: string | null
          nome?: string
          pasta_id?: string | null
          pedido_id?: string
          signing_token?: string | null
          storage_path?: string
          tamanho?: number | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      pedidos: {
        Row: {
          cliente_id: string
          codigo: string
          created_at: string
          critico: boolean | null
          data_chegada_material: string | null
          data_envio_fabrica: string | null
          data_limite_finalizacao: string | null
          data_medicao_tecnica: string | null
          data_montagem: string | null
          data_vistoria: string | null
          id: string
          is_adendo: boolean | null
          loja_id: string | null
          observacoes_venda: string | null
          orcamento_id: string | null
          pedido_pai_id: string | null
          status: string
          updated_at: string
          valor_total: number | null
          vip: boolean | null
          workflow_estagio: string | null
          workflow_iniciado_em: string | null
        }
        Insert: {
          cliente_id: string
          codigo: string
          created_at?: string
          critico?: boolean | null
          data_chegada_material?: string | null
          data_envio_fabrica?: string | null
          data_limite_finalizacao?: string | null
          data_medicao_tecnica?: string | null
          data_montagem?: string | null
          data_vistoria?: string | null
          id?: string
          is_adendo?: boolean | null
          loja_id?: string | null
          observacoes_venda?: string | null
          orcamento_id?: string | null
          pedido_pai_id?: string | null
          status?: string
          updated_at?: string
          valor_total?: number | null
          vip?: boolean | null
          workflow_estagio?: string | null
          workflow_iniciado_em?: string | null
        }
        Update: {
          cliente_id?: string
          codigo?: string
          created_at?: string
          critico?: boolean | null
          data_chegada_material?: string | null
          data_envio_fabrica?: string | null
          data_limite_finalizacao?: string | null
          data_medicao_tecnica?: string | null
          data_montagem?: string | null
          data_vistoria?: string | null
          id?: string
          is_adendo?: boolean | null
          loja_id?: string | null
          observacoes_venda?: string | null
          orcamento_id?: string | null
          pedido_pai_id?: string | null
          status?: string
          updated_at?: string
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
      pipeline_estagios: {
        Row: {
          ativo: boolean | null
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
          pipeline: string
        }
        Insert: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          pipeline: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          pipeline?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean | null
          avatar_url: string | null
          created_at: string
          id: string
          loja_id: string | null
          nome_completo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome_completo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          avatar_url?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          nome_completo?: string | null
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
      [_ in never]: never
    }
    Functions: {
      current_loja_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "montador"
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
      app_role: ["admin", "vendedor", "montador"],
    },
  },
} as const
