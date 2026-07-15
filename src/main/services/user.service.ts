/**
 * 用户管理服务
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { asc, eq } from 'drizzle-orm'
import type { User } from '@shared/types'
import { db, getNativeDatabase, users } from '../database/drizzle'
import { seedDefaultCategories } from '../database/seed'

const USER_COLORS = [
    '#F7BA1E',
    '#F77234',
    '#3491FA',
    '#33D573',
    '#722ED1',
    '#D91AD9',
    '#F53F3F',
    '#00B42A'
]

/**
 * 获取所有用户
 *
 * @returns 用户列表
 * @author xiangwei
 */
export async function listUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(asc(users.created_at))
}

/**
 * 判断用户是否存在
 *
 * @param id 用户 ID
 * @returns 用户是否存在
 * @author xiangwei
 */
export async function userExists(id: string): Promise<boolean> {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
    return Boolean(user)
}

/**
 * 创建用户并初始化默认分类
 *
 * @param name 用户名称
 * @returns 新用户
 * @author xiangwei
 */
export async function createUser(name: string): Promise<User> {
    const normalizedName = name.trim()
    if (!normalizedName) throw new Error('用户名称不能为空')

    const allUsers = await listUsers()
    const user: User = {
        id: randomUUID(),
        name: normalizedName,
        color: USER_COLORS[allUsers.length % USER_COLORS.length],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }

    const database = getNativeDatabase()
    const create = database.transaction(() => {
        database
            .prepare(
                `INSERT INTO users (id, name, color, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`
            )
            .run(user.id, user.name, user.color, user.created_at, user.updated_at)
        seedDefaultCategories(user.id)
        return user
    })
    return create()
}

/**
 * 删除用户及其全部数据
 *
 * @param id 用户 ID
 * @author xiangwei
 */
export async function deleteUser(id: string): Promise<void> {
    const database = getNativeDatabase()
    const remove = database.transaction(() => {
        const user = database.prepare('SELECT id FROM users WHERE id = ?').get(id)
        if (!user) throw new Error('用户不存在')

        database.prepare('DELETE FROM transactions WHERE user_id = ?').run(id)
        database
            .prepare(
                `DELETE FROM sub_categories
                 WHERE category_id IN (SELECT id FROM categories WHERE user_id = ?)`
            )
            .run(id)
        database.prepare('DELETE FROM budgets WHERE user_id = ?').run(id)
        database.prepare('DELETE FROM categories WHERE user_id = ?').run(id)
        database.prepare('DELETE FROM accounts WHERE user_id = ?').run(id)
        database.prepare('DELETE FROM users WHERE id = ?').run(id)
    })
    remove()
}
