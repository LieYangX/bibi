/**
 * 数据库连接初始化
 * @author xiangwei
 */

import { app } from 'electron'
import { join } from 'path'
import { closeDatabaseConnection, getNativeDatabase, initializeDatabaseConnection } from './drizzle'
import { runMigrations } from './drizzle/migrations'
import { migrationsDir } from './drizzle/migrations/paths'

let initialized = false

/**
 * 获取数据库文件路径
 *
 * 开发环境使用项目根目录下的 bibi-dev.db，方便查看和重置；
 * 打包后使用用户数据目录下的 bibi.db，遵循标准桌面应用规范。
 *
 * @returns 数据库文件绝对路径
 * @author xiangwei
 */
export function getDbPath(): string {
    if (app.isPackaged) {
        return join(app.getPath('userData'), 'bibi.db')
    }
    return join(app.getAppPath(), 'bibi-dev.db')
}

/**
 * 初始化数据库连接并执行迁移
 *
 * @author xiangwei
 */
export async function initDatabase(): Promise<void> {
    if (initialized) return

    initializeDatabaseConnection(getDbPath())
    try {
        runMigrations(getNativeDatabase(), migrationsDir)
        initialized = true
    } catch (error: unknown) {
        closeDatabaseConnection()
        throw error
    }
}

/**
 * 关闭数据库连接
 *
 * @author xiangwei
 */
export function closeDatabase(): void {
    closeDatabaseConnection()
    initialized = false
}

/**
 * 获取数据库初始化状态
 *
 * @returns 数据库初始化状态
 * @author xiangwei
 */
export function getDbStatus(): { initialized: boolean } {
    return { initialized }
}
