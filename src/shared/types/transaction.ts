/**
 * 共享类型定义 - 流水
 * @author xiangwei
 */

export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment'

export interface Transaction {
    id: string
    user_id: string
    type: TransactionType
    account_id: string
    target_account_id: string | null
    category_id: string | null
    sub_category_id: string | null
    amount_cents: number
    date: string
    time: string | null
    note: string | null
    transfer_pair_id: string | null
    is_deleted: number
    created_at: string
    updated_at: string

    // 联表查询时附带
    account_name?: string | null
    target_account_name?: string | null
    category_name?: string | null
    sub_category_name?: string | null
}

export interface CreateTransactionDTO {
    type: TransactionType
    account_id: string
    target_account_id?: string | null
    category_id?: string | null
    sub_category_id?: string | null
    amount_cents: number
    date: string
    time?: string | null
    note?: string | null
}

export interface UpdateTransactionDTO {
    type?: TransactionType
    account_id?: string
    target_account_id?: string | null
    category_id?: string | null
    sub_category_id?: string | null
    amount_cents?: number
    date?: string
    time?: string | null
    note?: string | null
}

/** 流水滚动分页游标 */
export interface TransactionCursor {
    date: string
    id: string
}

export interface TransactionFilter {
    start_date?: string
    end_date?: string
    type?: TransactionType | 'all'
    account_id?: string
    category_id?: string
    keyword?: string
    sort_field?: 'date' | 'amount_cents'
    sort_order?: 'asc' | 'desc'
    page?: number
    page_size?: number
    cursor?: TransactionCursor
}

export interface TransactionListResult {
    items: Transaction[]
    total: number
    page: number
    page_size: number
    has_more: boolean
    next_cursor: TransactionCursor | null
}

/** 批量删除流水结果 */
export interface BatchDeleteTransactionsResult {
    deleted_count: number
}
