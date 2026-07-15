/**
 * 共享类型定义 - 账户
 * @author xiangwei
 */

export type AccountType = 'bank' | 'wechat' | 'alipay' | 'cash' | 'credit' | 'other'

export interface Account {
    id: string
    user_id: string
    name: string
    type: AccountType
    initial_balance_cents: number
    balance_cents: number
    sort_order: number
    is_default: number
    is_hidden: number
    remark: string
    created_at: string
    updated_at: string
}

export interface CreateAccountDTO {
    name: string
    type: AccountType
    initial_balance_cents: number
    is_default?: boolean
    remark?: string
}

export interface UpdateAccountDTO {
    name?: string
    type?: AccountType
    is_default?: boolean
    remark?: string
}
