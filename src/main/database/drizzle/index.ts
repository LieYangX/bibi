/**
 * Drizzle ORM 数据库实例
 * @author xiangwei
 */

import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

export { schema }
export * from './schema'

let nativeDatabase: Database.Database | null = null

export let db: BetterSQLite3Database<typeof schema>

/**
 * 初始化 SQLite 与 Drizzle 实例
 *
 * @param databasePath 数据库文件路径
 * @author xiangwei
 */
export function initializeDatabaseConnection(databasePath: string): void {
    if (nativeDatabase) return

    nativeDatabase = new Database(databasePath)
    nativeDatabase.pragma('journal_mode = WAL')
    nativeDatabase.pragma('foreign_keys = ON')
    nativeDatabase.pragma('busy_timeout = 5000')
    db = drizzle(nativeDatabase, { schema, logger: false })
}

/**
 * 获取底层 SQLite 连接
 *
 * @returns SQLite 连接
 * @author xiangwei
 */
export function getNativeDatabase(): Database.Database {
    if (!nativeDatabase) {
        throw new Error('数据库尚未初始化')
    }
    return nativeDatabase
}

/**
 * 关闭数据库连接
 *
 * @author xiangwei
 */
export function closeDatabaseConnection(): void {
    nativeDatabase?.close()
    nativeDatabase = null
}
