/**
 * 共享类型定义 - 分类
 * @author xiangwei
 */

export type CategoryType = 'expense' | 'income'

export interface Category {
    id: string
    user_id: string
    name: string
    type: CategoryType
    icon: string
    is_system: number
    sort_order: number
    sub_categories?: SubCategory[]
    created_at: string
    updated_at: string
}

export interface SubCategory {
    id: string
    category_id: string
    name: string
    sort_order: number
}

export interface CreateCategoryDTO {
    name: string
    type: CategoryType
    icon?: string
}

export interface CreateSubCategoryDTO {
    category_id: string
    name: string
}

export interface UpdateCategoryDTO {
    name?: string
    icon?: string
}
