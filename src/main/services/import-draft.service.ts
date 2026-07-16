/**
 * 导入草稿的内存状态与编辑操作
 * @author xiangwei
 */

import type {
    ImportAccountRole,
    ImportDraftItem,
    ImportDraftOperation,
    ImportDraftSnapshot,
    ImportDraftSummary,
    ImportItemType,
    ImportRowState,
    ImportSource,
    ImportSourceFields
} from '@shared/types'
import { getNativeDatabase } from '../database/drizzle'

export interface ImportDraftEntry {
    id: string
    included: boolean
    type: ImportItemType
    account_id: string | null
    category_id: string | null
    sub_category_id: string | null
    date: string
    time: string | null
    amount_cents: number
    note: string
    source: ImportSourceFields
    external_transaction_id: string
    exclusion_reason: string | null
    invalid_reason: string | null
    is_duplicate: boolean
    duplicate_reason: string | null
}

export interface ImportDraftData {
    draft_id: string
    revision: number
    source: ImportSource
    file_name: string
    expires_at: number
    items: ImportDraftEntry[]
}

export interface ImportItemPresentation {
    state: ImportRowState
    issues: string[]
}

/**
 * 将内部草稿转换为可发送给渲染进程的快照
 *
 * @param draft 内部草稿
 * @returns 草稿快照
 * @author xiangwei
 */
export function getImportDraftSnapshot(draft: ImportDraftData): ImportDraftSnapshot {
    const items = draft.items.map(toPublicItem)
    return {
        draft_id: draft.draft_id,
        revision: draft.revision,
        source: draft.source,
        file_name: draft.file_name,
        expires_at: new Date(draft.expires_at).toISOString(),
        summary: summarizeItems(items),
        items
    }
}

/**
 * 应用一次草稿编辑并递增版本号
 *
 * @param draft 内部草稿
 * @param userId 用户 ID
 * @param operation 编辑操作
 * @returns 更新后的草稿快照
 * @author xiangwei
 */
export function applyImportDraftOperation(
    draft: ImportDraftData,
    userId: string,
    operation: ImportDraftOperation
): ImportDraftSnapshot {
    const workingDraft: ImportDraftData = {
        ...draft,
        items: draft.items.map(cloneDraftEntry)
    }

    if (operation.kind === 'set-included') {
        const items = operation.item_ids.map((id) => findDraftItem(workingDraft, id))
        if (operation.included) {
            for (const item of items) assertDraftItemCanBeIncluded(item)
        }
        for (const item of items) item.included = operation.included
    }

    if (operation.kind === 'map-category') {
        validateCategorySelection(
            userId,
            operation.item_type,
            operation.category_id,
            operation.sub_category_id
        )
        for (const item of workingDraft.items) {
            if (
                item.type === operation.item_type &&
                item.source.category === operation.source_category
            ) {
                item.category_id = operation.category_id
                item.sub_category_id = operation.sub_category_id
            }
        }
    }

    if (operation.kind === 'map-account') {
        validateAccountSelection(userId, operation.account_id)
        for (const item of workingDraft.items) {
            if (
                getImportAccountRole(item.type) === operation.role &&
                item.source.account_key === operation.source_account_key
            ) {
                item.account_id = operation.account_id
            }
        }
    }

    if (operation.kind === 'bulk-account') {
        validateAccountSelection(userId, operation.account_id)
        for (const item of workingDraft.items) {
            if (item.type === operation.item_type) item.account_id = operation.account_id
        }
    }

    if (operation.kind === 'update-item') {
        updateDraftItem(workingDraft, userId, operation.item_id, operation.changes)
    }

    workingDraft.revision++
    draft.items = workingDraft.items
    draft.revision = workingDraft.revision
    return getImportDraftSnapshot(draft)
}

/**
 * 获取收支类型对应的账户角色
 *
 * @param type 导入收支类型
 * @returns 账户角色，跳过项返回 null
 * @author xiangwei
 */
export function getImportAccountRole(type: ImportItemType): ImportAccountRole | null {
    if (type === 'expense') return 'payment'
    if (type === 'income') return 'receipt'
    return null
}

/**
 * 获取草稿项当前的阻断问题
 *
 * @param item 草稿项
 * @returns 状态和问题列表
 * @author xiangwei
 */
export function getImportItemPresentation(item: ImportDraftEntry): ImportItemPresentation {
    if (item.invalid_reason) {
        return { state: 'invalid', issues: [item.invalid_reason] }
    }
    if (item.is_duplicate) {
        return { state: 'duplicate', issues: [item.duplicate_reason ?? '重复流水不能再次导入'] }
    }
    if (!item.included || item.type === 'skip') {
        return {
            state: 'excluded',
            issues: item.exclusion_reason ? [item.exclusion_reason] : []
        }
    }

    const issues: string[] = []
    if (!item.account_id) issues.push(item.type === 'income' ? '未设置收款账户' : '未设置付款账户')
    if (!item.category_id) issues.push('未设置笔笔分类')
    return { state: issues.length > 0 ? 'unmapped' : 'ready', issues }
}

function updateDraftItem(
    draft: ImportDraftData,
    userId: string,
    itemId: string,
    changes: {
        included?: boolean
        type?: ImportItemType
        account_id?: string | null
        category_id?: string | null
        sub_category_id?: string | null
        note?: string
    }
): void {
    const item = findDraftItem(draft, itemId)

    if (changes.type !== undefined && changes.type !== item.type) {
        item.type = changes.type
        item.account_id = null
        item.category_id = null
        item.sub_category_id = null
        item.exclusion_reason = changes.type === 'skip' ? '已手动跳过' : null
        item.included =
            changes.type !== 'skip' && !item.is_duplicate && item.invalid_reason === null
    }
    if (changes.included !== undefined) {
        if (changes.included) assertDraftItemCanBeIncluded(item)
        item.included = changes.included
    }
    if (changes.account_id !== undefined) {
        validateAccountSelection(userId, changes.account_id)
        item.account_id = changes.account_id
    }

    const nextCategoryId =
        changes.category_id === undefined ? item.category_id : changes.category_id
    const nextSubCategoryId =
        changes.sub_category_id === undefined ? item.sub_category_id : changes.sub_category_id
    if (changes.category_id !== undefined || changes.sub_category_id !== undefined) {
        if (item.type === 'skip') throw new Error('跳过项不能设置分类')
        validateCategorySelection(userId, item.type, nextCategoryId, nextSubCategoryId)
        item.category_id = nextCategoryId
        item.sub_category_id = nextSubCategoryId
    }
    if (changes.note !== undefined) item.note = changes.note
}

function assertDraftItemCanBeIncluded(item: ImportDraftEntry): void {
    if (item.invalid_reason) throw new Error('无效流水不能导入')
    if (item.is_duplicate) throw new Error('重复流水不能再次导入')
    if (item.type === 'skip') throw new Error('跳过项不能导入')
}

function cloneDraftEntry(item: ImportDraftEntry): ImportDraftEntry {
    return {
        ...item,
        source: { ...item.source }
    }
}

function validateAccountSelection(userId: string, accountId: string | null): void {
    if (!accountId) return
    const account = getNativeDatabase()
        .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
        .get(accountId, userId)
    if (!account) throw new Error('账户不存在或不属于当前用户')
}

function validateCategorySelection(
    userId: string,
    itemType: 'expense' | 'income',
    categoryId: string | null,
    subCategoryId: string | null
): void {
    if (subCategoryId && !categoryId) throw new Error('选择二级分类时必须选择一级分类')
    if (!categoryId) return

    const database = getNativeDatabase()
    const category = database
        .prepare('SELECT id, type FROM categories WHERE id = ? AND user_id = ?')
        .get(categoryId, userId) as { id: string; type: string } | undefined
    if (!category) throw new Error('分类不存在或不属于当前用户')
    if (category.type !== itemType) throw new Error('分类类型与流水类型不匹配')

    if (subCategoryId) {
        const subCategory = database
            .prepare('SELECT id FROM sub_categories WHERE id = ? AND category_id = ?')
            .get(subCategoryId, categoryId)
        if (!subCategory) throw new Error('二级分类与一级分类不匹配')
    }
}

function findDraftItem(draft: ImportDraftData, itemId: string): ImportDraftEntry {
    const item = draft.items.find((candidate) => candidate.id === itemId)
    if (!item) throw new Error('导入草稿明细不存在')
    return item
}

function toPublicItem(item: ImportDraftEntry): ImportDraftItem {
    const presentation = getImportItemPresentation(item)
    return {
        id: item.id,
        included: item.included,
        type: item.type,
        account_id: item.account_id,
        category_id: item.category_id,
        sub_category_id: item.sub_category_id,
        date: item.date,
        time: item.time,
        amount_cents: item.amount_cents,
        note: item.note,
        state: presentation.state,
        issues: presentation.issues,
        source: { ...item.source }
    }
}

function summarizeItems(items: ImportDraftItem[]): ImportDraftSummary {
    const includedItems = items.filter((item) => item.included)
    const countState = (state: ImportRowState): number =>
        items.filter((item) => item.state === state).length
    const expenseItems = includedItems.filter((item) => item.type === 'expense')
    const incomeItems = includedItems.filter((item) => item.type === 'income')
    return {
        total: items.length,
        included: includedItems.length,
        ready: countState('ready'),
        unmapped: countState('unmapped'),
        duplicate: countState('duplicate'),
        excluded: countState('excluded'),
        invalid: countState('invalid'),
        expense_count: expenseItems.length,
        income_count: incomeItems.length,
        expense_cents: expenseItems.reduce((sum, item) => sum + item.amount_cents, 0),
        income_cents: incomeItems.reduce((sum, item) => sum + item.amount_cents, 0)
    }
}
