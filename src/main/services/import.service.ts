/**
 * 账单导入编排服务
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { basename } from 'path'
import type { ImportResult, ImportSource } from '@shared/types'
import { getNativeDatabase } from '../database/drizzle'
import { recomputeAccountBalance } from './account-balance.service'
import { parseBillRecords } from './import-bill-parser'
import { getDefaultImportCategoryName } from './import-default-mappings'
import {
    getImportAccountRole,
    getImportItemPresentation,
    type ImportDraftData,
    type ImportDraftEntry
} from './import-draft.service'
import { readImportFile } from './import-file-reader'
import {
    findImportedExternalIds,
    insertImportReference,
    loadImportMappings,
    upsertAccountMapping,
    upsertCategoryMapping
} from './import-mapping.service'

const MAX_IMPORT_ITEMS = 5_000

interface OwnedCategory {
    id: string
    type: 'expense' | 'income'
    name: string
}

interface OwnedAccount {
    id: string
    type: string
    name: string
}

/**
 * 读取账单并创建只驻留在内存中的导入草稿
 *
 * @param filePath 文件路径
 * @param source 账单来源
 * @param userId 用户 ID
 * @param expiresAt 草稿过期时间戳
 * @returns 内部导入草稿
 * @author xiangwei
 */
export async function createImportDraft(
    filePath: string,
    source: ImportSource,
    userId: string,
    expiresAt: number
): Promise<ImportDraftData> {
    const records = await readImportFile(filePath, source)
    const parsedRows = parseBillRecords(records, source)
    if (parsedRows.length === 0) throw new Error('未解析到有效账单明细')
    if (parsedRows.length > MAX_IMPORT_ITEMS) {
        throw new Error(`单次最多导入 ${MAX_IMPORT_ITEMS} 条记录`)
    }

    const database = getNativeDatabase()
    const categories = database
        .prepare('SELECT id, type, name FROM categories WHERE user_id = ?')
        .all(userId) as OwnedCategory[]
    const accounts = database
        .prepare('SELECT id, type, name FROM accounts WHERE user_id = ? AND is_hidden = 0')
        .all(userId) as OwnedAccount[]
    const mappings = loadImportMappings(userId, source)
    const importedIds = findImportedExternalIds(
        userId,
        source,
        parsedRows.map((row) => row.external_transaction_id)
    )
    const categoryMappingByKey = new Map(
        mappings.categoryMappings.map((mapping) => [
            createCategoryMappingKey(mapping.itemType, mapping.sourceCategory),
            mapping
        ])
    )
    const accountMappingByKey = new Map(
        mappings.accountMappings.map((mapping) => [
            createAccountMappingKey(mapping.role, mapping.sourceAccountKey),
            mapping.accountId
        ])
    )
    const categoryByName = new Map(
        categories.map((category) => [`${category.type}:${category.name}`, category])
    )

    const seenExternalIds = new Set<string>()
    const items = parsedRows.map<ImportDraftEntry>((row) => {
        const externalId = row.external_transaction_id
        const isDuplicateInFile = Boolean(externalId && seenExternalIds.has(externalId))
        if (externalId) seenExternalIds.add(externalId)
        const isAlreadyImported = importedIds.has(externalId)
        const isDuplicate = isAlreadyImported || isDuplicateInFile
        const categorySelection = resolveInitialCategory(
            source,
            row.type,
            row.source_category,
            categoryMappingByKey,
            categoryByName
        )
        const role = getImportAccountRole(row.type)
        const mappedAccountId = role
            ? (accountMappingByKey.get(createAccountMappingKey(role, row.source_account_key)) ??
              findSuggestedAccountId(source, row.source_account_key, accounts))
            : null
        const invalidReason = !row.external_transaction_id
            ? '缺少渠道交易号'
            : row.amount_cents <= 0
              ? '金额必须大于 0'
              : null

        return {
            id: randomUUID(),
            included: row.default_included && !isDuplicate && !invalidReason,
            type: row.type,
            account_id: mappedAccountId,
            category_id: categorySelection.categoryId,
            sub_category_id: categorySelection.subCategoryId,
            date: row.date,
            amount_cents: row.amount_cents,
            note: row.note,
            source: {
                category: row.source_category,
                transaction_type: row.source_transaction_type,
                direction: row.source_direction,
                account_raw: row.source_account_raw,
                account_key: row.source_account_key,
                status: row.source_status,
                counterparty: row.counterparty,
                product: row.product
            },
            external_transaction_id: row.external_transaction_id,
            exclusion_reason: row.exclusion_reason,
            invalid_reason: invalidReason,
            is_duplicate: isDuplicate,
            duplicate_reason: isAlreadyImported
                ? '该渠道交易已导入'
                : isDuplicateInFile
                  ? '账单文件内交易号重复'
                  : null
        }
    })

    return {
        draft_id: randomUUID(),
        revision: 0,
        source,
        file_name: basename(filePath),
        expires_at: expiresAt,
        items
    }
}

/**
 * 校验草稿并在单个数据库事务中完成最终导入
 *
 * @param userId 用户 ID
 * @param draft 导入草稿
 * @param rememberMappings 是否保存本次映射
 * @returns 导入结果
 * @author xiangwei
 */
export async function confirmImportDraft(
    userId: string,
    draft: ImportDraftData,
    rememberMappings: boolean
): Promise<ImportResult> {
    const selectedItems = draft.items.filter((item) => item.included)
    if (selectedItems.length === 0) throw new Error('没有选中可导入的账单')

    const blockedItem = selectedItems.find(
        (item) => getImportItemPresentation(item).state !== 'ready'
    )
    if (blockedItem) {
        const issue = getImportItemPresentation(blockedItem).issues[0] ?? '存在未完成映射的账单'
        throw new Error(issue)
    }

    const database = getNativeDatabase()
    validateFinalRelations(userId, selectedItems)
    const alreadyImportedIds = findImportedExternalIds(
        userId,
        draft.source,
        selectedItems.map((item) => item.external_transaction_id),
        database
    )
    const importableItems = selectedItems.filter(
        (item) => !alreadyImportedIds.has(item.external_transaction_id)
    )
    const writeImport = database.transaction(() => {
        const now = new Date().toISOString()
        const affectedAccountIds = new Set<string>()
        const insertTransaction = database.prepare(
            `INSERT INTO transactions (
                id, user_id, type, account_id, category_id, sub_category_id,
                amount_cents, date, note, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        for (const item of importableItems) {
            const transactionId = randomUUID()
            insertTransaction.run(
                transactionId,
                userId,
                item.type,
                item.account_id,
                item.category_id,
                item.sub_category_id,
                item.amount_cents,
                item.date,
                item.note || null,
                now,
                now
            )
            insertImportReference(
                transactionId,
                userId,
                draft.source,
                item.external_transaction_id,
                database
            )
            affectedAccountIds.add(item.account_id!)
        }

        if (rememberMappings) {
            saveStableMappings(userId, draft.source, importableItems, database)
        }
        for (const accountId of affectedAccountIds) {
            recomputeAccountBalance(accountId, userId)
        }
    })
    writeImport()

    const expenseItems = importableItems.filter((item) => item.type === 'expense')
    const incomeItems = importableItems.filter((item) => item.type === 'income')
    return {
        success_count: importableItems.length,
        skip_count: draft.items.length - importableItems.length,
        expense_cents: expenseItems.reduce((sum, item) => sum + item.amount_cents, 0),
        income_cents: incomeItems.reduce((sum, item) => sum + item.amount_cents, 0)
    }
}

function resolveInitialCategory(
    source: ImportSource,
    itemType: ImportDraftEntry['type'],
    sourceCategory: string,
    storedMappings: Map<string, { categoryId: string; subCategoryId: string | null }>,
    categoriesByName: Map<string, OwnedCategory>
): { categoryId: string | null; subCategoryId: string | null } {
    if (itemType === 'skip') return { categoryId: null, subCategoryId: null }
    const stored = storedMappings.get(createCategoryMappingKey(itemType, sourceCategory))
    if (stored) {
        return { categoryId: stored.categoryId, subCategoryId: stored.subCategoryId }
    }
    const defaultName = getDefaultImportCategoryName(source, itemType, sourceCategory)
    return {
        categoryId: categoriesByName.get(`${itemType}:${defaultName}`)?.id ?? null,
        subCategoryId: null
    }
}

function findSuggestedAccountId(
    source: ImportSource,
    sourceAccountKey: string,
    accounts: OwnedAccount[]
): string | null {
    if (!sourceAccountKey) return null
    const normalizedKey = normalizeAccountName(sourceAccountKey)
    const exact = accounts.find((account) => normalizeAccountName(account.name) === normalizedKey)
    if (exact) return exact.id
    if (source === 'wechat' && /微信|零钱/u.test(sourceAccountKey)) {
        return accounts.find((account) => account.type === 'wechat')?.id ?? null
    }
    if (source === 'alipay' && /支付宝|余额宝/u.test(sourceAccountKey)) {
        return accounts.find((account) => account.type === 'alipay')?.id ?? null
    }
    return null
}

function validateFinalRelations(userId: string, items: ImportDraftEntry[]): void {
    const database = getNativeDatabase()
    const accountIds = new Set(
        (
            database.prepare('SELECT id FROM accounts WHERE user_id = ?').all(userId) as Array<{
                id: string
            }>
        ).map((row) => row.id)
    )
    const categories = new Map(
        (
            database
                .prepare('SELECT id, type FROM categories WHERE user_id = ?')
                .all(userId) as Array<{ id: string; type: string }>
        ).map((row) => [row.id, row.type])
    )
    const subCategories = new Map(
        (
            database
                .prepare(
                    `SELECT sub_categories.id, sub_categories.category_id
                     FROM sub_categories
                     INNER JOIN categories ON sub_categories.category_id = categories.id
                     WHERE categories.user_id = ?`
                )
                .all(userId) as Array<{ id: string; category_id: string }>
        ).map((row) => [row.id, row.category_id])
    )

    for (const item of items) {
        if (item.type === 'skip') throw new Error('跳过项不能执行导入')
        if (!Number.isInteger(item.amount_cents) || item.amount_cents <= 0) {
            throw new Error('金额必须是大于 0 的整数分值')
        }
        if (!item.account_id || !accountIds.has(item.account_id)) {
            throw new Error('账户不存在或不属于当前用户')
        }
        if (!item.category_id || categories.get(item.category_id) !== item.type) {
            throw new Error('分类类型与流水类型不匹配')
        }
        if (item.sub_category_id && subCategories.get(item.sub_category_id) !== item.category_id) {
            throw new Error('二级分类与一级分类不匹配')
        }
    }
}

function saveStableMappings(
    userId: string,
    source: ImportSource,
    importedItems: ImportDraftEntry[],
    database: ReturnType<typeof getNativeDatabase>
): void {
    const categoryGroups = new Map<string, ImportDraftEntry[]>()
    const accountGroups = new Map<string, ImportDraftEntry[]>()
    for (const item of importedItems) {
        if (item.type === 'skip') continue
        addToGroup(categoryGroups, createCategoryMappingKey(item.type, item.source.category), item)
        const role = getImportAccountRole(item.type)!
        if (item.source.account_key) {
            addToGroup(accountGroups, createAccountMappingKey(role, item.source.account_key), item)
        }
    }

    for (const items of categoryGroups.values()) {
        const first = items[0]
        const targets = new Set(
            items.map((item) => `${item.category_id ?? ''}:${item.sub_category_id ?? ''}`)
        )
        if (targets.size !== 1 || !first.category_id || first.type === 'skip') continue
        upsertCategoryMapping(
            userId,
            source,
            first.type,
            first.source.category,
            first.category_id,
            first.sub_category_id,
            database
        )
    }

    for (const items of accountGroups.values()) {
        const first = items[0]
        const targets = new Set(items.map((item) => item.account_id ?? ''))
        const role = getImportAccountRole(first.type)
        if (targets.size !== 1 || !first.account_id || !role) continue
        upsertAccountMapping(
            userId,
            source,
            role,
            first.source.account_key,
            first.account_id,
            database
        )
    }
}

function addToGroup(
    groups: Map<string, ImportDraftEntry[]>,
    key: string,
    item: ImportDraftEntry
): void {
    const items = groups.get(key) ?? []
    items.push(item)
    groups.set(key, items)
}

function createCategoryMappingKey(type: 'expense' | 'income', sourceCategory: string): string {
    return JSON.stringify([type, sourceCategory])
}

function createAccountMappingKey(role: string, sourceAccountKey: string): string {
    return JSON.stringify([role, sourceAccountKey])
}

function normalizeAccountName(value: string): string {
    return value.replace(/[\s()（）]/gu, '').toLowerCase()
}
