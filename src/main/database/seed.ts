/**
 * 数据库预设数据初始化
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { getNativeDatabase } from './drizzle'
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './presets'
import { logger } from '../utils/logger'

/**
 * 为新用户创建默认分类
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export function seedDefaultCategories(userId: string): void {
    const database = getNativeDatabase()
    const existing = database
        .prepare('SELECT COUNT(*) AS count FROM categories WHERE user_id = ?')
        .get(userId) as { count: number }
    if (existing.count > 0) return

    const insertCategory = database.prepare(
        `INSERT INTO categories (
            id, user_id, name, type, icon, is_system, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    const insertSubCategory = database.prepare(
        `INSERT INTO sub_categories (id, category_id, name, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?)`
    )

    const seed = database.transaction(() => {
        const now = new Date().toISOString()
        let sortOrder = 1

        for (const category of DEFAULT_EXPENSE_CATEGORIES) {
            const categoryId = randomUUID()
            insertCategory.run(
                categoryId,
                userId,
                category.name,
                'expense',
                category.icon,
                0,
                sortOrder,
                now,
                now
            )
            category.subCategories.forEach((name, index) => {
                insertSubCategory.run(randomUUID(), categoryId, name, index + 1, now)
            })
            sortOrder++
        }

        for (const category of DEFAULT_INCOME_CATEGORIES) {
            const categoryId = randomUUID()
            insertCategory.run(
                categoryId,
                userId,
                category.name,
                'income',
                category.icon,
                0,
                sortOrder,
                now,
                now
            )
            category.subCategories.forEach((name, index) => {
                insertSubCategory.run(randomUUID(), categoryId, name, index + 1, now)
            })
            sortOrder++
        }
    })

    seed()
    logger.info('DbSeed', '默认分类初始化完成', { userId })
}
