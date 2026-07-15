/**
 * 共享类型定义 - 统计概览
 * @author xiangwei
 */

import type { BudgetWithProgress } from './budget'

export interface MonthlyStatistics {
    year: number
    month: number
    total_income_cents: number
    total_expense_cents: number
    balance_cents: number
    total_balance_cents: number
    expense_categories: CategoryStat[]
    income_categories: CategoryStat[]
    daily_expense: DailyStat[]
    budgets: BudgetWithProgress[]
}

export interface AnnualStatistics {
    year: number
    total_income_cents: number
    total_expense_cents: number
    balance_cents: number
    total_balance_cents: number
    expense_categories: CategoryStat[]
    income_categories: CategoryStat[]
    monthly_expense: MonthlyExpenseStat[]
    budgets: BudgetWithProgress[]
}

export interface MonthlyExpenseStat {
    month: number
    amount_cents: number
}

export interface CategoryStat {
    category_id: string | null
    category_name: string
    amount_cents: number
    percentage: number
}

export interface DailyStat {
    date: string
    amount_cents: number
}
