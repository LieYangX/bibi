/**
 * 账户管理服务
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { and, count, eq, sql } from 'drizzle-orm'
import type { Account, CreateAccountDTO, UpdateAccountDTO } from '@shared/types'
import { accounts, db, getNativeDatabase } from '../database/drizzle'
import { recomputeAccountBalance } from './account-balance.service'

/**
 * 检查账户名称是否已存在
 *
 * @param name 账户名称
 * @param userId 用户 ID
 * @param excludeId 排除的账户 ID
 * @returns 是否存在同名账户
 * @author xiangwei
 */
async function checkNameExists(name: string, userId: string, excludeId?: string): Promise<boolean> {
    const condition = excludeId
        ? and(
              eq(accounts.user_id, userId),
              eq(accounts.name, name),
              sql`${accounts.id} != ${excludeId}`
          )
        : and(eq(accounts.user_id, userId), eq(accounts.name, name))
    const rows = await db.select({ value: count() }).from(accounts).where(condition)
    return (rows[0]?.value ?? 0) > 0
}

/**
 * 获取用户账户列表
 *
 * @param userId 用户 ID
 * @returns 账户列表
 * @author xiangwei
 */
export async function listAccounts(userId: string): Promise<Account[]> {
    const rows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.user_id, userId))
        .orderBy(accounts.sort_order)
    return rows as Account[]
}

/**
 * 创建账户
 *
 * @param data 账户数据
 * @param userId 用户 ID
 * @returns 新账户
 * @author xiangwei
 */
export async function createAccount(data: CreateAccountDTO, userId: string): Promise<Account> {
    if (await checkNameExists(data.name, userId)) {
        throw new Error('账户名称已存在')
    }

    const database = getNativeDatabase()
    const create = database.transaction(() => {
        if (data.is_default) {
            database.prepare('UPDATE accounts SET is_default = 0 WHERE user_id = ?').run(userId)
        }

        const id = randomUUID()
        const now = new Date().toISOString()
        database
            .prepare(
                `INSERT INTO accounts (
                    id, user_id, name, type, initial_balance_cents, balance_cents,
                    sort_order, is_default, is_hidden, remark, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)`
            )
            .run(
                id,
                userId,
                data.name,
                data.type,
                data.initial_balance_cents,
                data.initial_balance_cents,
                data.is_default ? 1 : 0,
                data.remark ?? '',
                now,
                now
            )
        return database.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account
    })
    return create()
}

/**
 * 更新账户
 *
 * @param id 账户 ID
 * @param data 更新数据
 * @param userId 用户 ID
 * @returns 更新后的账户
 * @author xiangwei
 */
export async function updateAccount(
    id: string,
    data: UpdateAccountDTO,
    userId: string
): Promise<Account | null> {
    if (data.name !== undefined && (await checkNameExists(data.name, userId, id))) {
        throw new Error('账户名称已存在')
    }

    const database = getNativeDatabase()
    const update = database.transaction(() => {
        const existing = database
            .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
            .get(id, userId) as Account | undefined
        if (!existing) return null

        if (data.is_default) {
            database.prepare('UPDATE accounts SET is_default = 0 WHERE user_id = ?').run(userId)
        }
        database
            .prepare(
                `UPDATE accounts
                 SET name = ?, type = ?, is_default = ?, remark = ?, updated_at = ?
                 WHERE id = ? AND user_id = ?`
            )
            .run(
                data.name ?? existing.name,
                data.type ?? existing.type,
                data.is_default === undefined ? existing.is_default : data.is_default ? 1 : 0,
                data.remark ?? existing.remark,
                new Date().toISOString(),
                id,
                userId
            )
        return database
            .prepare('SELECT * FROM accounts WHERE id = ? AND user_id = ?')
            .get(id, userId) as Account
    })
    return update()
}

/**
 * 删除账户及关联流水
 *
 * @param id 账户 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function deleteAccount(id: string, userId: string): Promise<void> {
    const database = getNativeDatabase()
    const remove = database.transaction(() => {
        const account = database
            .prepare('SELECT id FROM accounts WHERE id = ? AND user_id = ?')
            .get(id, userId)
        if (!account) throw new Error('账户不存在')

        const relatedTransactions = database
            .prepare(
                `SELECT account_id, target_account_id
                 FROM transactions
                 WHERE user_id = ? AND (account_id = ? OR target_account_id = ?)`
            )
            .all(userId, id, id) as Array<{
            account_id: string
            target_account_id: string | null
        }>
        const affectedAccountIds = new Set<string>()
        for (const transaction of relatedTransactions) {
            affectedAccountIds.add(transaction.account_id)
            if (transaction.target_account_id) {
                affectedAccountIds.add(transaction.target_account_id)
            }
        }

        database
            .prepare(
                `DELETE FROM transactions
                 WHERE user_id = ? AND (account_id = ? OR target_account_id = ?)`
            )
            .run(userId, id, id)
        database.prepare('DELETE FROM accounts WHERE id = ? AND user_id = ?').run(id, userId)

        affectedAccountIds.delete(id)
        for (const accountId of affectedAccountIds) {
            recomputeAccountBalance(accountId, userId)
        }
    })
    remove()
}
