// Database types - will be generated from Supabase schema
// For now, placeholder structure based on CLAUDE.md spec

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          user_id: string
          currency: string
          locale: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          currency?: string
          locale?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          currency?: string
          locale?: string
          created_at?: string
          updated_at?: string
        }
      }
      income_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
      }
      expense_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
      }
      expense_subcategories: {
        Row: {
          id: string
          category_id: string
          user_id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id: string
          user_id: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          user_id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
      }
      saving_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
      }
      debt_items: {
        Row: {
          id: string
          user_id: string
          name: string
          total_amount: number
          remaining_amount: number
          interest_rate: number | null
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          total_amount: number
          remaining_amount: number
          interest_rate?: number | null
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          total_amount?: number
          remaining_amount?: number
          interest_rate?: number | null
          due_date?: string | null
          created_at?: string
        }
      }
      monthly_budgets: {
        Row: {
          id: string
          user_id: string
          month: number
          year: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month: number
          year: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month?: number
          year?: number
          created_at?: string
        }
      }
      monthly_budget_items: {
        Row: {
          id: string
          budget_id: string
          category_type: 'income' | 'expense' | 'saving'
          category_id: string
          planned_amount: number
          actual_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          category_type: 'income' | 'expense' | 'saving'
          category_id: string
          planned_amount: number
          actual_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          category_type?: 'income' | 'expense' | 'saving'
          category_id?: string
          planned_amount?: number
          actual_amount?: number
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: 'income' | 'expense' | 'saving' | 'debt'
          category_id: string
          subcategory_id: string | null
          amount: number
          date: string
          description: string | null
          payment_method: string | null
          tags: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'income' | 'expense' | 'saving' | 'debt'
          category_id: string
          subcategory_id?: string | null
          amount: number
          date: string
          description?: string | null
          payment_method?: string | null
          tags?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'income' | 'expense' | 'saving' | 'debt'
          category_id?: string
          subcategory_id?: string | null
          amount?: number
          date?: string
          description?: string | null
          payment_method?: string | null
          tags?: string[] | null
          created_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          user_id: string
          name: string
          amount: number
          due_date: string
          paid_date: string | null
          recurrence: 'once' | 'monthly' | 'yearly' | null
          status: 'pending' | 'paid' | 'overdue'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          amount: number
          due_date: string
          paid_date?: string | null
          recurrence?: 'once' | 'monthly' | 'yearly' | null
          status?: 'pending' | 'paid' | 'overdue'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          amount?: number
          due_date?: string
          paid_date?: string | null
          recurrence?: 'once' | 'monthly' | 'yearly' | null
          status?: 'pending' | 'paid' | 'overdue'
          created_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          type: 'saving' | 'debt'
          target_amount: number
          current_amount: number
          deadline: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          type: 'saving' | 'debt'
          target_amount: number
          current_amount?: number
          deadline?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: 'saving' | 'debt'
          target_amount?: number
          current_amount?: number
          deadline?: string | null
          created_at?: string
        }
      }
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
