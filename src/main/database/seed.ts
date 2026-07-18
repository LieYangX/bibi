/**
 * 数据库预设数据初始化
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { getNativeDatabase } from './drizzle'
import { CATEGORY_COLORS, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './presets'
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
            id, user_id, name, type, icon, color, is_system, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
                category.color,
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
                category.color,
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
    backfillCategoryColors(userId)
    logger.info('DbSeed', '默认分类初始化完成', { userId })
}

/**
 * 为所有颜色为空的一级分类分配颜色
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export function backfillCategoryColors(userId?: string): void {
    const database = getNativeDatabase()
    const rows = database
        .prepare(
            userId
                ? `SELECT id, sort_order FROM categories WHERE (color IS NULL OR color = '') AND user_id = ? ORDER BY sort_order`
                : `SELECT id, sort_order FROM categories WHERE (color IS NULL OR color = '') ORDER BY sort_order`
        )
        .all(...(userId ? [userId] : [])) as Array<{ id: string; sort_order: number }>

    if (rows.length === 0) return

    // 对全库做回填时偏移按分类排序；对单个用户做回填时按 sort_order 偏移
    const update = database.prepare('UPDATE categories SET color = ? WHERE id = ?')
    const fill = database.transaction(() => {
        for (let i = 0; i < rows.length; i++) {
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length]
            update.run(color, rows[i].id)
        }
    })
    fill()
    logger.info('CategorySeed', `回填了 ${rows.length} 个分类的颜色`, { userId })
}
