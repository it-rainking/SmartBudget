export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          user_id: string
          currency: string
          locale: string
          initial_balance: number
          onboarding_completed: boolean
          notify_email: boolean
          notify_telegram: boolean
          telegram_chat_id: string | null
          notification_email: string | null
          payment_methods: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          currency?: string
          locale?: string
          initial_balance?: number
          onboarding_completed?: boolean
          notify_email?: boolean
          notify_telegram?: boolean
          telegram_chat_id?: string | null
          notification_email?: string | null
          payment_methods?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          currency?: string
          locale?: string
          initial_balance?: number
          onboarding_completed?: boolean
          notify_email?: boolean
          notify_telegram?: boolean
          telegram_chat_id?: string | null
          notification_email?: string | null
          payment_methods?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      income_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          color: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          color: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_subcategories: {
        Row: {
          id: string
          category_id: string
          user_id: string
          name: string
          icon: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          user_id: string
          name: string
          icon?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          user_id?: string
          name?: string
          icon?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expense_subcategories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'expense_categories'
            referencedColumns: ['id']
          }
        ]
      }
      saving_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          color: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          color?: string
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      debt_items: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          total_amount: number
          remaining_amount: number
          interest_rate: number | null
          start_date: string | null
          due_date: string | null
          monthly_payment: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          total_amount: number
          remaining_amount: number
          interest_rate?: number | null
          start_date?: string | null
          due_date?: string | null
          monthly_payment?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          total_amount?: number
          remaining_amount?: number
          interest_rate?: number | null
          start_date?: string | null
          due_date?: string | null
          monthly_payment?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_budgets: {
        Row: {
          id: string
          user_id: string
          month: number
          year: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: number
          year: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: number
          year?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      monthly_budget_items: {
        Row: {
          id: string
          budget_id: string
          user_id: string
          category_type: 'income' | 'expense' | 'saving'
          category_id: string
          planned_amount: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          user_id: string
          category_type: 'income' | 'expense' | 'saving'
          category_id: string
          planned_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          user_id?: string
          category_type?: 'income' | 'expense' | 'saving'
          category_id?: string
          planned_amount?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: 'income' | 'expense' | 'saving' | 'debt'
          category_id: string | null
          subcategory_id: string | null
          amount: number
          date: string
          description: string | null
          payment_method: string | null
          tags: string[] | null
          notes: string | null
          is_recurring: boolean
          recurring_id: string | null
          recurring_expense_id: string | null
          installment_plan_id: string | null
          installment_number: number | null
          installment_count: number | null
          is_exceptional: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'income' | 'expense' | 'saving' | 'debt'
          category_id?: string | null
          subcategory_id?: string | null
          amount: number
          date: string
          description?: string | null
          payment_method?: string | null
          tags?: string[] | null
          notes?: string | null
          is_recurring?: boolean
          recurring_id?: string | null
          recurring_expense_id?: string | null
          installment_plan_id?: string | null
          installment_number?: number | null
          installment_count?: number | null
          is_exceptional?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'income' | 'expense' | 'saving' | 'debt'
          category_id?: string | null
          subcategory_id?: string | null
          amount?: number
          date?: string
          description?: string | null
          payment_method?: string | null
          tags?: string[] | null
          notes?: string | null
          is_recurring?: boolean
          recurring_id?: string | null
          recurring_expense_id?: string | null
          installment_plan_id?: string | null
          installment_number?: number | null
          installment_count?: number | null
          is_exceptional?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_recurring_expense_id_fkey'
            columns: ['recurring_expense_id']
            isOneToOne: false
            referencedRelation: 'recurring_expenses'
            referencedColumns: ['id']
          }
        ]
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          amount: number
          due_date: string
          paid_date: string | null
          paid_amount: number | null
          recurrence: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null
          status: 'pending' | 'paid' | 'overdue' | 'cancelled'
          category_id: string | null
          reminder_days: number
          auto_renew: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          amount: number
          due_date: string
          paid_date?: string | null
          paid_amount?: number | null
          recurrence?: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null
          status?: 'pending' | 'paid' | 'overdue' | 'cancelled'
          category_id?: string | null
          reminder_days?: number
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          amount?: number
          due_date?: string
          paid_date?: string | null
          paid_amount?: number | null
          recurrence?: 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null
          status?: 'pending' | 'paid' | 'overdue' | 'cancelled'
          category_id?: string | null
          reminder_days?: number
          auto_renew?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          type: 'saving' | 'debt'
          target_amount: number
          current_amount: number
          deadline: string | null
          category_id: string | null
          icon: string | null
          color: string | null
          is_completed: boolean
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          type: 'saving' | 'debt'
          target_amount: number
          current_amount?: number
          deadline?: string | null
          category_id?: string | null
          icon?: string | null
          color?: string | null
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          type?: 'saving' | 'debt'
          target_amount?: number
          current_amount?: number
          deadline?: string | null
          category_id?: string | null
          icon?: string | null
          color?: string | null
          is_completed?: boolean
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'budget_exceeded' | 'bill_due' | 'goal_achieved' | 'goal_progress' | 'system'
          title: string
          message: string
          data: Record<string, unknown> | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'budget_exceeded' | 'bill_due' | 'goal_achieved' | 'goal_progress' | 'system'
          title: string
          message: string
          data?: Record<string, unknown> | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'budget_exceeded' | 'bill_due' | 'goal_achieved' | 'goal_progress' | 'system'
          title?: string
          message?: string
          data?: Record<string, unknown> | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          id: string
          user_id: string
          isin: string
          ticker_gf: string
          ticker_yahoo: string | null
          name: string
          asset_class: 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other'
          currency: string
          price_divisor: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          isin: string
          ticker_gf?: string
          ticker_yahoo?: string | null
          name: string
          asset_class: 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other'
          currency?: string
          price_divisor?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          isin?: string
          ticker_gf?: string
          ticker_yahoo?: string | null
          name?: string
          asset_class?: 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other'
          currency?: string
          price_divisor?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      holdings: {
        Row: {
          id: string
          user_id: string
          asset_id: string
          quantity: number
          avg_cost: number
          source: string
          imported_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          asset_id: string
          quantity: number
          avg_cost: number
          source?: string
          imported_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          asset_id?: string
          quantity?: number
          avg_cost?: number
          source?: string
          imported_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'holdings_asset_id_fkey'
            columns: ['asset_id']
            isOneToOne: false
            referencedRelation: 'assets'
            referencedColumns: ['id']
          }
        ]
      }
      price_snapshots: {
        Row: {
          id: number
          asset_id: string
          price: number
          change_pct: number | null
          currency: string
          source: 'gsheet' | 'yahoo'
          fetched_at: string
        }
        Insert: {
          id?: number
          asset_id: string
          price: number
          change_pct?: number | null
          currency: string
          source: 'gsheet' | 'yahoo'
          fetched_at?: string
        }
        Update: {
          id?: number
          asset_id?: string
          price?: number
          change_pct?: number | null
          currency?: string
          source?: 'gsheet' | 'yahoo'
          fetched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_snapshots_asset_id_fkey'
            columns: ['asset_id']
            isOneToOne: false
            referencedRelation: 'assets'
            referencedColumns: ['id']
          }
        ]
      }
      isin_ticker_lookup: {
        Row: {
          isin: string
          ticker_gf: string | null
          ticker_yahoo: string | null
          name: string | null
          asset_class: 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          isin: string
          ticker_gf?: string | null
          ticker_yahoo?: string | null
          name?: string | null
          asset_class?: 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          isin?: string
          ticker_gf?: string | null
          ticker_yahoo?: string | null
          name?: string | null
          asset_class?: 'etf_equity' | 'etf_bond' | 'etf_thematic' | 'stock' | 'bond' | 'cash' | 'other' | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          base: string
          quote: string
          rate: number
          source: 'gsheet' | 'yahoo'
          fetched_at: string
        }
        Insert: {
          base: string
          quote: string
          rate: number
          source: 'gsheet' | 'yahoo'
          fetched_at?: string
        }
        Update: {
          base?: string
          quote?: string
          rate?: number
          source?: 'gsheet' | 'yahoo'
          fetched_at?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          id: string
          user_id: string
          name: string
          category_id: string | null
          subcategory_id: string | null
          amount: number
          day_of_month: number
          payment_method: string | null
          notes: string | null
          start_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          category_id?: string | null
          subcategory_id?: string | null
          amount: number
          day_of_month: number
          payment_method?: string | null
          notes?: string | null
          start_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          category_id?: string | null
          subcategory_id?: string | null
          amount?: number
          day_of_month?: number
          payment_method?: string | null
          notes?: string | null
          start_date?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recurring_expenses_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'expense_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recurring_expenses_subcategory_id_fkey'
            columns: ['subcategory_id']
            isOneToOne: false
            referencedRelation: 'expense_subcategories'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      get_investment_summary: {
        Args: { p_user_id: string }
        Returns: {
          holding_id: string
          asset_id: string
          isin: string
          ticker_gf: string
          ticker_yahoo: string | null
          name: string
          asset_class: string
          currency: string
          price_divisor: number
          quantity: number
          avg_cost: number
          imported_at: string
          last_price: number | null
          change_pct: number | null
          price_source: 'gsheet' | 'yahoo' | null
          fetched_at: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
