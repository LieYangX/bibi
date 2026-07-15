/**
 * 系统设置服务
 * 以 key-value 形式持久化全局配置
 * @author xiangwei
 */

import { eq } from 'drizzle-orm'
import { db, settings } from '../database/drizzle'

/**
 * 读取设置值
 * 若记录不存在则返回默认值
 *
 * @param key 设置键
 * @param defaultValue 默认值
 * @returns 解析后的设置值或默认值
 */
export async function getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    const [row] = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1)
    if (!row) return defaultValue
    try {
        return JSON.parse(row.value) as T
    } catch {
        return defaultValue
    }
}

/**
 * 写入或更新设置值
 * value 会被序列化为 JSON 字符串存储
 *
 * @param key 设置键
 * @param value 设置值
 */
export async function setSetting(key: string, value: unknown): Promise<void> {
    const valueStr = JSON.stringify(value)
    if (valueStr === undefined) {
        throw new Error('设置值必须可序列化为 JSON')
    }
    const now = new Date().toISOString()
    const [existing] = await db
        .select({ key: settings.key })
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1)

    if (existing) {
        await db
            .update(settings)
            .set({ value: valueStr, updated_at: now })
            .where(eq(settings.key, key))
    } else {
        await db.insert(settings).values({ key, value: valueStr, created_at: now, updated_at: now })
    }
}
