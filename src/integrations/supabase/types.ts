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
      approval_rules: {
        Row: {
          active: boolean | null
          affected_roles: string[] | null
          approver_role: string
          created_at: string
          description: string | null
          id: string
          max_percent: number | null
          rule_type: string
        }
        Insert: {
          active?: boolean | null
          affected_roles?: string[] | null
          approver_role?: string
          created_at?: string
          description?: string | null
          id?: string
          max_percent?: number | null
          rule_type?: string
        }
        Update: {
          active?: boolean | null
          affected_roles?: string[] | null
          approver_role?: string
          created_at?: string
          description?: string | null
          id?: string
          max_percent?: number | null
          rule_type?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          active: boolean | null
          agency: string | null
          balance: number | null
          bank: string | null
          created_at: string
          id: string
          last_check_date: string | null
          name: string
        }
        Insert: {
          account_number?: string | null
          active?: boolean | null
          agency?: string | null
          balance?: number | null
          bank?: string | null
          created_at?: string
          id?: string
          last_check_date?: string | null
          name: string
        }
        Update: {
          account_number?: string | null
          active?: boolean | null
          agency?: string | null
          balance?: number | null
          bank?: string | null
          created_at?: string
          id?: string
          last_check_date?: string | null
          name?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          billing_address: string | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          phone_secondary: string | null
          store_id: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          phone_secondary?: string | null
          store_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          phone_secondary?: string | null
          store_id?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          active: boolean | null
          content: string | null
          created_at: string
          id: string
          name: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          content?: string | null
          created_at?: string
          id?: string
          name: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          content: string | null
          created_at: string
          footer_notes: string | null
          id: string
          notes: string | null
          order_id: string
          pdf_url: string | null
          sent_at: string | null
          signature_link: string | null
          signed_at: string | null
          status: string
          store_id: string | null
          template_id: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          footer_notes?: string | null
          id?: string
          notes?: string | null
          order_id: string
          pdf_url?: string | null
          sent_at?: string | null
          signature_link?: string | null
          signed_at?: string | null
          status?: string
          store_id?: string | null
          template_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string
          footer_notes?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          pdf_url?: string | null
          sent_at?: string | null
          signature_link?: string | null
          signed_at?: string | null
          status?: string
          store_id?: string | null
          template_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          bank_account_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          discount: number | null
          due_date: string | null
          id: string
          installment_number: number | null
          notes: string | null
          order_id: string | null
          paid_date: string | null
          paid_value: number | null
          payment_method: string | null
          reconciled: boolean | null
          reconciled_at: string | null
          reconciled_by: string | null
          recurring: boolean | null
          source: string | null
          status: string | null
          surcharge: number | null
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          bank_account_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount?: number | null
          due_date?: string | null
          id?: string
          installment_number?: number | null
          notes?: string | null
          order_id?: string | null
          paid_date?: string | null
          paid_value?: number | null
          payment_method?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          recurring?: boolean | null
          source?: string | null
          status?: string | null
          surcharge?: number | null
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          bank_account_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          discount?: number | null
          due_date?: string | null
          id?: string
          installment_number?: number | null
          notes?: string | null
          order_id?: string | null
          paid_date?: string | null
          paid_value?: number | null
          payment_method?: string | null
          reconciled?: boolean | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          recurring?: boolean | null
          source?: string | null
          status?: string | null
          surcharge?: number | null
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          created_at: string
          default_discount_rate_monthly: number
          id: string
          updated_at: string
          vpl_alert_threshold: number
        }
        Insert: {
          created_at?: string
          default_discount_rate_monthly?: number
          id?: string
          updated_at?: string
          vpl_alert_threshold?: number
        }
        Update: {
          created_at?: string
          default_discount_rate_monthly?: number
          id?: string
          updated_at?: string
          vpl_alert_threshold?: number
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          client_id: string
          closed_at: string | null
          code: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          opened_at: string
          order_id: string
          photo_url: string | null
          priority: string | null
          responsible_id: string | null
          solution: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          code?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          opened_at?: string
          order_id: string
          photo_url?: string | null
          priority?: string | null
          responsible_id?: string | null
          solution?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          code?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          opened_at?: string
          order_id?: string
          photo_url?: string | null
          priority?: string | null
          responsible_id?: string | null
          solution?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_environments: {
        Row: {
          created_at: string
          description: string | null
          factory_cost: number | null
          id: string
          name: string
          order_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          factory_cost?: number | null
          id?: string
          name: string
          order_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          factory_cost?: number | null
          id?: string
          name?: string
          order_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_environments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string
          depth: number | null
          description: string
          environment_id: string
          extra_cost: number | null
          factory_price: number | null
          final_price: number | null
          finish: string | null
          height: number | null
          id: string
          import_id: string | null
          index_num: number | null
          project_ref: string | null
          quantity: number | null
          width: number | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string
          depth?: number | null
          description: string
          environment_id: string
          extra_cost?: number | null
          factory_price?: number | null
          final_price?: number | null
          finish?: string | null
          height?: number | null
          id?: string
          import_id?: string | null
          index_num?: number | null
          project_ref?: string | null
          quantity?: number | null
          width?: number | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string
          depth?: number | null
          description?: string
          environment_id?: string
          extra_cost?: number | null
          factory_price?: number | null
          final_price?: number | null
          finish?: string | null
          height?: number | null
          id?: string
          import_id?: string | null
          index_num?: number | null
          project_ref?: string | null
          quantity?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "order_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approval_reason: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          assembler_id: string | null
          assembly_date: string | null
          assembly_status: string | null
          client_id: string
          code: string
          contract_notes: string | null
          contract_status: string | null
          created_at: string
          delivery_status: string | null
          discount_percent: number | null
          discount_rate_monthly: number | null
          discount_value: number | null
          factory_send_date: string | null
          final_value: number | null
          financial_status: string | null
          id: string
          inspection_date: string | null
          installments_generated: boolean | null
          internal_comments: string | null
          npv_value: number | null
          occurrence_status: string | null
          order_date: string
          post_assembly_status: string | null
          production_status: string | null
          quote_id: string | null
          revision_status: string | null
          seller_id: string | null
          snapshot: Json | null
          store_id: string | null
          tags: string[] | null
          total_cost: number | null
          total_value: number | null
          updated_at: string
        }
        Insert: {
          approval_reason?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assembler_id?: string | null
          assembly_date?: string | null
          assembly_status?: string | null
          client_id: string
          code: string
          contract_notes?: string | null
          contract_status?: string | null
          created_at?: string
          delivery_status?: string | null
          discount_percent?: number | null
          discount_rate_monthly?: number | null
          discount_value?: number | null
          factory_send_date?: string | null
          final_value?: number | null
          financial_status?: string | null
          id?: string
          inspection_date?: string | null
          installments_generated?: boolean | null
          internal_comments?: string | null
          npv_value?: number | null
          occurrence_status?: string | null
          order_date?: string
          post_assembly_status?: string | null
          production_status?: string | null
          quote_id?: string | null
          revision_status?: string | null
          seller_id?: string | null
          snapshot?: Json | null
          store_id?: string | null
          tags?: string[] | null
          total_cost?: number | null
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          approval_reason?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assembler_id?: string | null
          assembly_date?: string | null
          assembly_status?: string | null
          client_id?: string
          code?: string
          contract_notes?: string | null
          contract_status?: string | null
          created_at?: string
          delivery_status?: string | null
          discount_percent?: number | null
          discount_rate_monthly?: number | null
          discount_value?: number | null
          factory_send_date?: string | null
          final_value?: number | null
          financial_status?: string | null
          id?: string
          inspection_date?: string | null
          installments_generated?: boolean | null
          internal_comments?: string | null
          npv_value?: number | null
          occurrence_status?: string | null
          order_date?: string
          post_assembly_status?: string | null
          production_status?: string | null
          quote_id?: string | null
          revision_status?: string | null
          seller_id?: string | null
          snapshot?: Json | null
          store_id?: string | null
          tags?: string[] | null
          total_cost?: number | null
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      origins_config: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string
          display_order: number
          id: string
          is_final: boolean | null
          is_initial: boolean | null
          name: string
          pipeline_type: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_final?: boolean | null
          is_initial?: boolean | null
          name: string
          pipeline_type: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_final?: boolean | null
          is_initial?: boolean | null
          name?: string
          pipeline_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promob_imports: {
        Row: {
          address: string | null
          client_name: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          delivery_address: string | null
          environment_id: string | null
          id: string
          import_date: string | null
          neighborhood: string | null
          order_id: string | null
          phone: string | null
          project_id: string | null
          promob_version: string | null
          quote_environment_id: string | null
          quote_id: string | null
          raw_content: string | null
          status: string | null
          store_name: string | null
          version: number | null
        }
        Insert: {
          address?: string | null
          client_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          environment_id?: string | null
          id?: string
          import_date?: string | null
          neighborhood?: string | null
          order_id?: string | null
          phone?: string | null
          project_id?: string | null
          promob_version?: string | null
          quote_environment_id?: string | null
          quote_id?: string | null
          raw_content?: string | null
          status?: string | null
          store_name?: string | null
          version?: number | null
        }
        Update: {
          address?: string | null
          client_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          delivery_address?: string | null
          environment_id?: string | null
          id?: string
          import_date?: string | null
          neighborhood?: string | null
          order_id?: string | null
          phone?: string | null
          project_id?: string | null
          promob_version?: string | null
          quote_environment_id?: string | null
          quote_id?: string | null
          raw_content?: string | null
          status?: string | null
          store_name?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promob_imports_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "order_environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promob_imports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_environments: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          factory_cost: number | null
          id: string
          name: string
          quote_id: string
          value: number | null
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          factory_cost?: number | null
          id?: string
          name: string
          quote_id: string
          value?: number | null
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          factory_cost?: number | null
          id?: string
          name?: string
          quote_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_environments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_installments: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          number: number
          payment_method: string | null
          quote_id: string
          value: number
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          number: number
          payment_method?: string | null
          quote_id: string
          value: number
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          number?: number
          payment_method?: string | null
          quote_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_installments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string
          depth: number | null
          description: string
          environment_id: string
          extra_cost: number | null
          factory_price: number | null
          final_price: number | null
          finish: string | null
          height: number | null
          id: string
          import_id: string | null
          index_num: number | null
          project_ref: string | null
          quantity: number | null
          width: number | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string
          depth?: number | null
          description: string
          environment_id: string
          extra_cost?: number | null
          factory_price?: number | null
          final_price?: number | null
          finish?: string | null
          height?: number | null
          id?: string
          import_id?: string | null
          index_num?: number | null
          project_ref?: string | null
          quantity?: number | null
          width?: number | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string
          depth?: number | null
          description?: string
          environment_id?: string
          extra_cost?: number | null
          factory_price?: number | null
          final_price?: number | null
          finish?: string | null
          height?: number | null
          id?: string
          import_id?: string | null
          index_num?: number | null
          project_ref?: string | null
          quantity?: number | null
          width?: number | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          approval_reason: string | null
          approval_requested_at: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          code: string
          created_at: string
          discount_percent: number | null
          discount_rate_monthly: number | null
          discount_value: number | null
          expiry_date: string | null
          final_value: number | null
          focal_point: string | null
          id: string
          interest_percent: number | null
          notes: string | null
          npv_value: number | null
          origin: string | null
          seller_id: string | null
          start_date: string | null
          status: string
          store_id: string | null
          surcharge: number | null
          tags: string[] | null
          total_cost: number | null
          total_value: number | null
          updated_at: string
          urgency: string | null
        }
        Insert: {
          approval_reason?: string | null
          approval_requested_at?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          code: string
          created_at?: string
          discount_percent?: number | null
          discount_rate_monthly?: number | null
          discount_value?: number | null
          expiry_date?: string | null
          final_value?: number | null
          focal_point?: string | null
          id?: string
          interest_percent?: number | null
          notes?: string | null
          npv_value?: number | null
          origin?: string | null
          seller_id?: string | null
          start_date?: string | null
          status?: string
          store_id?: string | null
          surcharge?: number | null
          tags?: string[] | null
          total_cost?: number | null
          total_value?: number | null
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          approval_reason?: string | null
          approval_requested_at?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          code?: string
          created_at?: string
          discount_percent?: number | null
          discount_rate_monthly?: number | null
          discount_value?: number | null
          expiry_date?: string | null
          final_value?: number | null
          focal_point?: string | null
          id?: string
          interest_percent?: number | null
          notes?: string | null
          npv_value?: number | null
          origin?: string | null
          seller_id?: string | null
          start_date?: string | null
          status?: string
          store_id?: string | null
          surcharge?: number | null
          tags?: string[] | null
          total_cost?: number | null
          total_value?: number | null
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          active: boolean | null
          address: string | null
          cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags_config: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          id?: string
          name: string
          type?: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "diretoria"
        | "gerente_loja"
        | "vendedor"
        | "revisao"
        | "financeiro"
        | "montagem"
        | "pos_venda"
        | "projetista"
        | "conferente"
        | "atendente"
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
      app_role: [
        "admin",
        "diretoria",
        "gerente_loja",
        "vendedor",
        "revisao",
        "financeiro",
        "montagem",
        "pos_venda",
        "projetista",
        "conferente",
        "atendente",
      ],
    },
  },
} as const
