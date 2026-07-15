/**
 * 共享类型定义 - 数据导入
 * @author xiangwei
 */

export type ImportSource = 'alipay' | 'wechat'
export type ImportItemType = 'expense' | 'income' | 'skip'
export type ImportAccountRole = 'payment' | 'receipt'
export type ImportRowState = 'ready' | 'unmapped' | 'duplicate' | 'excluded' | 'invalid'

export interface ImportSourceFields {
    category: string
    transaction_type: string
    direction: string
    account_raw: string
    account_key: string
    status: string
    counterparty: string
    product: string
}

export interface ImportDraftItem {
    id: string
    included: boolean
    type: ImportItemType
    account_id: string | null
    category_id: string | null
    sub_category_id: string | null
    date: string
    amount_cents: number
    note: string
    state: ImportRowState
    issues: string[]
    source: ImportSourceFields
}

export interface ImportDraftSummary {
    total: number
    included: number
    ready: number
    unmapped: number
    duplicate: number
    excluded: number
    invalid: number
    expense_count: number
    income_count: number
    expense_cents: number
    income_cents: number
}

export interface ImportDraftSnapshot {
    draft_id: string
    revision: number
    source: ImportSource
    file_name: string
    expires_at: string
    summary: ImportDraftSummary
    items: ImportDraftItem[]
}

export interface ImportDraftRowChanges {
    included?: boolean
    type?: ImportItemType
    account_id?: string | null
    category_id?: string | null
    sub_category_id?: string | null
    note?: string
}

export type ImportDraftOperation =
    | {
          kind: 'set-included'
          item_ids: string[]
          included: boolean
      }
    | {
          kind: 'map-category'
          item_type: 'expense' | 'income'
          source_category: string
          category_id: string | null
          sub_category_id: string | null
      }
    | {
          kind: 'map-account'
          role: ImportAccountRole
          source_account_key: string
          account_id: string | null
      }
    | {
          kind: 'bulk-account'
          item_type: 'expense' | 'income'
          account_id: string | null
      }
    | {
          kind: 'update-item'
          item_id: string
          changes: ImportDraftRowChanges
      }

export interface ImportDraftUpdateDTO {
    draft_id: string
    revision: number
    operation: ImportDraftOperation
}

export interface ImportConfirmDTO {
    draft_id: string
    revision: number
    remember_mappings: boolean
}

export interface ImportDiscardDTO {
    draft_id: string
}

export interface ImportResult {
    success_count: number
    skip_count: number
    expense_cents: number
    income_cents: number
}
