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
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_default_categories: {
        Args: { p_user_id: string }
        Returns: undefined
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
