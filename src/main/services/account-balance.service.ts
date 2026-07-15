/**
 * 账户余额计算服务
 * @author xiangwei
 */

import { getNativeDatabase } from '../database/drizzle'

/**
 * 根据有效流水重新计算账户余额
 * 当前连接处于事务时，本操作自动加入同一事务
 *
 * @param accountId 账户 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export function recomputeAccountBalance(accountId: string, userId: string): void {
    const database = getNativeDatabase()
    database
        .prepare(
            `UPDATE accounts
             SET balance_cents = initial_balance_cents + COALESCE((
                 SELECT SUM(
                     CASE
                         WHEN type = 'expense' THEN -amount_cents
                         WHEN type = 'income' THEN amount_cents
                         WHEN type = 'transfer' AND account_id = @accountId THEN -amount_cents
                         WHEN type = 'transfer' AND target_account_id = @accountId THEN amount_cents
                         WHEN type = 'adjustment' THEN amount_cents
                         ELSE 0
                     END
                 )
                 FROM transactions
                 WHERE user_id = @userId
                   AND is_deleted = 0
                   AND (account_id = @accountId OR target_account_id = @accountId)
             ), 0)
             WHERE id = @accountId AND user_id = @userId`
        )
        .run({ accountId, userId })
}
