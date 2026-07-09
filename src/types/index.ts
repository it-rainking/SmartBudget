// Core types for SmartBudget

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Settings {
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

export interface IncomeCategory {
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

export interface ExpenseCategory {
  id: string
  user_id: string
  name: string
  icon: string | null
  color: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  subcategories?: ExpenseSubcategory[]
}

export interface ExpenseSubcategory {
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

export interface SavingCategory {
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

export interface DebtItem {
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

export interface MonthlyBudget {
  id: string
  user_id: string
  month: number
  year: number
  notes: string | null
  created_at: string
  updated_at: string
  items?: MonthlyBudgetItem[]
}

export interface MonthlyBudgetItem {
  id: string
  budget_id: string
  user_id: string
  category_type: 'income' | 'expense' | 'saving'
  category_id: string
  planned_amount: number
  created_at: string
  updated_at: string
}

export type TransactionType = 'income' | 'expense' | 'saving' | 'debt'

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
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
  // Joined fields
  category?: IncomeCategory | ExpenseCategory | SavingCategory
  subcategory?: ExpenseSubcategory
}

export type InvoiceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type InvoiceRecurrence = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Invoice {
  id: string
  user_id: string
  name: string
  description: string | null
  amount: number
  due_date: string
  paid_date: string | null
  paid_amount: number | null
  recurrence: InvoiceRecurrence | null
  status: InvoiceStatus
  category_id: string | null
  reminder_days: number
  auto_renew: boolean
  created_at: string
  updated_at: string
}

export type GoalType = 'saving' | 'debt'

export interface Goal {
  id: string
  user_id: string
  name: string
  description: string | null
  type: GoalType
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

// Dashboard KPIs
export interface MonthlyKPIs {
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  totalDebts: number
  balance: number
  incomePercent: number
  expensePercent: number
  savingsPercent: number
}

// Form types
export interface TransactionFormData {
  type: TransactionType
  category_id?: string
  subcategory_id?: string
  amount: number
  date: string
  description?: string
  payment_method?: string
  tags?: string[]
  notes?: string
}

export interface CategoryFormData {
  name: string
  icon?: string
  color?: string
}
