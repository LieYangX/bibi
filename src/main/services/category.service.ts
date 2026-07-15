/**
 * 分类管理服务
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type {
    Category,
    CategoryType,
    CreateCategoryDTO,
    CreateSubCategoryDTO,
    SubCategory,
    UpdateCategoryDTO
} from '@shared/types'
import { categories, db, getNativeDatabase, subCategories } from '../database/drizzle'
import { seedDefaultCategories } from '../database/seed'
import { logger } from '../utils/logger'

type CategoryWithChildren = Category & { sub_categories: SubCategory[] }

/**
 * 获取用户分类列表
 *
 * @param userId 用户 ID
 * @param type 分类类型
 * @returns 分类列表
 * @author xiangwei
 */
export async function listCategories(
    userId: string,
    type?: CategoryType
): Promise<CategoryWithChildren[]> {
    const conditions = [eq(categories.user_id, userId)]
    if (type) conditions.push(eq(categories.type, type))

    const categoryRows = await db
        .select()
        .from(categories)
        .where(and(...conditions))
        .orderBy(asc(categories.sort_order))
    if (categoryRows.length === 0) return []

    const categoryIds = categoryRows.map((category) => category.id)
    const subCategoryRows = await db
        .select()
        .from(subCategories)
        .where(inArray(subCategories.category_id, categoryIds))
        .orderBy(asc(subCategories.sort_order))

    const subCategoriesByParent = new Map<string, SubCategory[]>()
    for (const subCategory of subCategoryRows) {
        const children = subCategoriesByParent.get(subCategory.category_id) ?? []
        children.push(subCategory)
        subCategoriesByParent.set(subCategory.category_id, children)
    }

    return categoryRows.map((category) => ({
        ...(category as Category),
        sub_categories: subCategoriesByParent.get(category.id) ?? []
    }))
}

/**
 * 创建一级分类
 *
 * @param data 分类数据
 * @param userId 用户 ID
 * @returns 新分类
 * @author xiangwei
 */
export async function createCategory(data: CreateCategoryDTO, userId: string): Promise<Category> {
    const id = randomUUID()
    const now = new Date().toISOString()
    const icon = data.icon || 'IconBook'

    const [maxRow] = await db
        .select({ maxSort: sql<number>`COALESCE(MAX(sort_order), 0)` })
        .from(categories)
        .where(and(eq(categories.user_id, userId), eq(categories.type, data.type)))
    const nextSortOrder = (maxRow?.maxSort ?? 0) + 1

    await db.insert(categories).values({
        id,
        user_id: userId,
        name: data.name,
        type: data.type,
        icon,
        sort_order: nextSortOrder,
        created_at: now,
        updated_at: now
    })

    return {
        id,
        user_id: userId,
        name: data.name,
        type: data.type,
        icon,
        is_system: 0,
        sort_order: nextSortOrder,
        created_at: now,
        updated_at: now,
        sub_categories: []
    }
}

/**
 * 创建二级分类
 *
 * @param data 二级分类数据
 * @param userId 用户 ID
 * @returns 新二级分类
 * @author xiangwei
 */
export async function createSubCategory(
    data: CreateSubCategoryDTO,
    userId: string
): Promise<SubCategory> {
    const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, data.category_id), eq(categories.user_id, userId)))
        .limit(1)
    if (!parent) {
        throw new Error('一级分类不存在')
    }

    const [maxRow] = await db
        .select({ maxSort: sql<number>`COALESCE(MAX(sort_order), 0)` })
        .from(subCategories)
        .where(eq(subCategories.category_id, data.category_id))
    const nextSortOrder = (maxRow?.maxSort ?? 0) + 1
    const subCategory: SubCategory = {
        id: randomUUID(),
        category_id: data.category_id,
        name: data.name,
        sort_order: nextSortOrder
    }

    await db.insert(subCategories).values(subCategory)
    return subCategory
}

/**
 * 更新一级分类
 *
 * @param id 分类 ID
 * @param data 更新数据
 * @param userId 用户 ID
 * @returns 更新后的分类
 * @author xiangwei
 */
export async function updateCategory(
    id: string,
    data: UpdateCategoryDTO,
    userId: string
): Promise<Category | null> {
    const updateValues: Partial<typeof categories.$inferInsert> = {
        updated_at: new Date().toISOString()
    }
    if (data.name !== undefined) updateValues.name = data.name
    if (data.icon !== undefined) updateValues.icon = data.icon

    await db
        .update(categories)
        .set(updateValues)
        .where(and(eq(categories.id, id), eq(categories.user_id, userId)))

    const [category] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.id, id), eq(categories.user_id, userId)))
        .limit(1)
    return category ? (category as Category) : null
}

/**
 * 删除一级分类
 *
 * @param id 分类 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function deleteCategory(id: string, userId: string): Promise<void> {
    const database = getNativeDatabase()
    const remove = database.transaction(() => {
        const category = database
            .prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?')
            .get(id, userId)
        if (!category) throw new Error('分类不存在')

        database
            .prepare(
                `UPDATE transactions
                 SET category_id = NULL, sub_category_id = NULL
                 WHERE user_id = ? AND category_id = ?`
            )
            .run(userId, id)
        database
            .prepare('DELETE FROM budgets WHERE user_id = ? AND category_id = ?')
            .run(userId, id)
        database.prepare('DELETE FROM sub_categories WHERE category_id = ?').run(id)
        database.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(id, userId)
    })
    remove()
}

/**
 * 重置用户默认分类
 *
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function resetDefaults(userId: string): Promise<void> {
    logger.info('CategoryService', '开始重置默认分类', { userId })

    const database = getNativeDatabase()
    const reset = database.transaction(() => {
        database
            .prepare(
                `UPDATE transactions
                 SET category_id = NULL, sub_category_id = NULL
                 WHERE user_id = ?`
            )
            .run(userId)
        database
            .prepare('DELETE FROM budgets WHERE user_id = ? AND category_id IS NOT NULL')
            .run(userId)
        database
            .prepare(
                `DELETE FROM sub_categories
                 WHERE category_id IN (SELECT id FROM categories WHERE user_id = ?)`
            )
            .run(userId)
        database.prepare('DELETE FROM categories WHERE user_id = ?').run(userId)
        seedDefaultCategories(userId)
    })
    reset()

    logger.info('CategoryService', '默认分类重置完成', { userId })
}

/**
 * 更新二级分类
 *
 * @param id 二级分类 ID
 * @param data 更新数据
 * @param userId 用户 ID
 * @returns 更新后的二级分类
 * @author xiangwei
 */
export async function updateSubCategory(
    id: string,
    data: { name: string },
    userId: string
): Promise<SubCategory | null> {
    const [ownedSubCategory] = await db
        .select({ id: subCategories.id })
        .from(subCategories)
        .innerJoin(categories, eq(subCategories.category_id, categories.id))
        .where(and(eq(subCategories.id, id), eq(categories.user_id, userId)))
        .limit(1)
    if (!ownedSubCategory) return null

    await db.update(subCategories).set({ name: data.name }).where(eq(subCategories.id, id))
    const [subCategory] = await db
        .select()
        .from(subCategories)
        .where(eq(subCategories.id, id))
        .limit(1)
    return subCategory ?? null
}

/**
 * 删除二级分类
 *
 * @param id 二级分类 ID
 * @param userId 用户 ID
 * @author xiangwei
 */
export async function deleteSubCategory(id: string, userId: string): Promise<void> {
    const database = getNativeDatabase()
    const remove = database.transaction(() => {
        const ownedSubCategory = database
            .prepare(
                `SELECT sub_categories.id
                 FROM sub_categories
                 INNER JOIN categories ON sub_categories.category_id = categories.id
                 WHERE sub_categories.id = ? AND categories.user_id = ?`
            )
            .get(id, userId)
        if (!ownedSubCategory) throw new Error('子分类不存在')

        database
            .prepare(
                `UPDATE transactions
                 SET sub_category_id = NULL
                 WHERE user_id = ? AND sub_category_id = ?`
            )
            .run(userId, id)
        database.prepare('DELETE FROM sub_categories WHERE id = ?').run(id)
    })
    remove()
}
