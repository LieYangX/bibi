/**
 * 共享类型定义 - 预算
 * @author xiangwei
 */

export interface Budget {
    id: string
    user_id: string
    category_id: string | null
    year: number
    month: number
    amount_cents: number
    created_at: string
    updated_at: string
}

export interface SetBudgetDTO {
    category_id?: string | null
    year: number
    month: number
    amount_cents: number
}

export interface BudgetWithProgress extends Budget {
    used_cents: number
    progress_pct: number
    category_name?: string
}
