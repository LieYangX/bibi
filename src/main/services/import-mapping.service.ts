/**
 * 导入映射与外部交易幂等引用服务
 * @author xiangwei
 */

import type { ImportAccountRole, ImportSource } from '@shared/types'
import { getNativeDatabase } from '../database/drizzle'

type ImportTransactionType = 'expense' | 'income'
type NativeDatabase = ReturnType<typeof getNativeDatabase>

export interface StoredImportCategoryMapping {
    itemType: ImportTransactionType
    sourceCategory: string
    categoryId: string
    subCategoryId: string | null
}

export interface StoredImportAccountMapping {
    role: ImportAccountRole
    sourceAccountKey: string
    accountId: string
}

export interface StoredImportMappings {
    categoryMappings: StoredImportCategoryMapping[]
    accountMappings: StoredImportAccountMapping[]
}

/**
 * 加载当前用户在指定渠道保存的映射
 *
 * @param userId 用户 ID
 * @param source 导入渠道
 * @returns 分类与账户映射
 * @author xiangwei
 */
export function loadImportMappings(userId: string, source: ImportSource): StoredImportMappings {
    const database = getNativeDatabase()
    const categoryRows = database
        .prepare(
            `SELECT item_type AS itemType,
                    source_category AS sourceCategory,
                    category_id AS categoryId,
                    sub_category_id AS subCategoryId
             FROM import_category_mappings
             WHERE user_id = ? AND source = ?`
        )
        .all(userId, source) as StoredImportCategoryMapping[]
    const accountRows = database
        .prepare(
            `SELECT role,
                    source_account_key AS sourceAccountKey,
                    account_id AS accountId
             FROM import_account_mappings
             WHERE user_id = ? AND source = ?`
        )
        .all(userId, source) as StoredImportAccountMapping[]
    return { categoryMappings: categoryRows, accountMappings: accountRows }
}

/**
 * 查询已经导入的渠道交易号
 *
 * @param userId 用户 ID
 * @param source 导入渠道
 * @param externalIds 渠道交易号
 * @param database 数据库连接
 * @returns 已导入交易号集合
 * @author xiangwei
 */
export function findImportedExternalIds(
    userId: string,
    source: ImportSource,
    externalIds: string[],
    database: NativeDatabase = getNativeDatabase()
): Set<string> {
    const uniqueIds = [...new Set(externalIds.filter(Boolean))]
    const importedIds = new Set<string>()
    const batchSize = 500
    for (let start = 0; start < uniqueIds.length; start += batchSize) {
        const batch = uniqueIds.slice(start, start + batchSize)
        const placeholders = batch.map(() => '?').join(', ')
        const rows = database
            .prepare(
                `SELECT external_id AS externalId
                 FROM transaction_import_refs
                 WHERE user_id = ? AND source = ? AND external_id IN (${placeholders})`
            )
            .all(userId, source, ...batch) as Array<{ externalId: string }>
        for (const row of rows) importedIds.add(row.externalId)
    }
    return importedIds
}

/**
 * 写入流水与渠道交易号的幂等引用
 *
 * @param transactionId 流水 ID
 * @param userId 用户 ID
 * @param source 导入渠道
 * @param externalId 渠道交易号
 * @param database 数据库连接
 * @author xiangwei
 */
export function insertImportReference(
    transactionId: string,
    userId: string,
    source: ImportSource,
    externalId: string,
    database: NativeDatabase = getNativeDatabase()
): void {
    database
        .prepare(
            `INSERT INTO transaction_import_refs (
                transaction_id, user_id, source, external_id
            ) VALUES (?, ?, ?, ?)`
        )
        .run(transactionId, userId, source, externalId)
}

/**
 * 新增或覆盖分类映射
 *
 * @param userId 用户 ID
 * @param source 导入渠道
 * @param itemType 收支类型
 * @param sourceCategory 来源分类
 * @param categoryId 笔笔一级分类 ID
 * @param subCategoryId 笔笔二级分类 ID
 * @param database 数据库连接
 * @author xiangwei
 */
export function upsertCategoryMapping(
    userId: string,
    source: ImportSource,
    itemType: ImportTransactionType,
    sourceCategory: string,
    categoryId: string,
    subCategoryId: string | null,
    database: NativeDatabase = getNativeDatabase()
): void {
    const now = new Date().toISOString()
    database
        .prepare(
            `INSERT INTO import_category_mappings (
                user_id, source, item_type, source_category,
                category_id, sub_category_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, source, item_type, source_category)
            DO UPDATE SET
                category_id = excluded.category_id,
                sub_category_id = excluded.sub_category_id,
                updated_at = excluded.updated_at`
        )
        .run(userId, source, itemType, sourceCategory, categoryId, subCategoryId, now, now)
}

/**
 * 新增或覆盖账户映射
 *
 * @param userId 用户 ID
 * @param source 导入渠道
 * @param role 账户角色
 * @param sourceAccountKey 来源账户键
 * @param accountId 笔笔账户 ID
 * @param database 数据库连接
 * @author xiangwei
 */
export function upsertAccountMapping(
    userId: string,
    source: ImportSource,
    role: ImportAccountRole,
    sourceAccountKey: string,
    accountId: string,
    database: NativeDatabase = getNativeDatabase()
): void {
    const now = new Date().toISOString()
    database
        .prepare(
            `INSERT INTO import_account_mappings (
                user_id, source, role, source_account_key,
                account_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, source, role, source_account_key)
            DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at`
        )
        .run(userId, source, role, sourceAccountKey, accountId, now, now)
}
