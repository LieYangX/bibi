/**
 * 数据库迁移运行器
 * 每个迁移文件在独立事务中执行，失败时阻止应用启动
 * @author xiangwei
 */

import type Database from 'better-sqlite3'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const META_TABLE = '__drizzle_migrations'

const LEGACY_MIGRATION_COLUMNS: Record<string, Record<string, string[]>> = {
    '0000_puzzling_magma': {
        users: ['id', 'name', 'color'],
        accounts: ['id', 'user_id', 'name', 'type', 'balance_cents'],
        categories: ['id', 'user_id', 'name', 'type'],
        sub_categories: ['id', 'category_id', 'name'],
        transactions: ['id', 'user_id', 'account_id', 'amount_cents', 'date'],
        budgets: ['id', 'user_id', 'year', 'month', 'amount_cents']
    },
    '0001_add_settings_table': {
        settings: ['key', 'value', 'created_at', 'updated_at']
    },
    '0001_amused_blonde_phantom': {
        import_account_mappings: ['user_id', 'source', 'role', 'source_account_key', 'account_id'],
        import_category_mappings: [
            'user_id',
            'source',
            'item_type',
            'source_category',
            'category_id'
        ],
        transaction_import_refs: ['transaction_id', 'user_id', 'source', 'external_id']
    },
    '0003_add_model_to_conversations': {
        agent_conversations: [
            'id',
            'user_id',
            'title',
            'message_count',
            'created_at',
            'updated_at',
            'model'
        ]
    },
    '0004_add_thinking_duration': {
        agent_messages: ['id', 'conversation_id', 'role', 'content', 'thinking_duration_ms']
    },
    '0005_melted_stryfe': {
        transactions: ['id', 'time']
    },
    '0006_simple_ma_gnuci': {
        agent_conversations: ['source']
    }
}

interface MigrationRecord {
    hash: string
}

/**
 * 判断旧版本数据库是否已经具备迁移创建的表
 *
 * @param database SQLite 连接
 * @param hash 迁移标识
 * @returns 是否已具备对应结构
 * @author xiangwei
 */
function hasLegacyMigrationSchema(database: Database.Database, hash: string): boolean {
    const requiredTables = LEGACY_MIGRATION_COLUMNS[hash]
    if (!requiredTables) return false

    return Object.entries(requiredTables).every(([tableName, requiredColumns]) => {
        const rows = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
            name: string
        }>
        const existingColumns = new Set(rows.map((row) => row.name))
        return requiredColumns.every((column) => existingColumns.has(column))
    })
}

/**
 * 运行所有待执行迁移
 *
 * @param database SQLite 连接
 * @param migrationsDir 迁移目录
 * @author xiangwei
 */
export function runMigrations(database: Database.Database, migrationsDir: string): void {
    const files = readdirSync(migrationsDir)
        .filter((file) => file.endsWith('.sql'))
        .sort()
    if (files.length === 0) {
        throw new Error(`迁移目录中没有 SQL 文件: ${migrationsDir}`)
    }

    database.exec(
        `CREATE TABLE IF NOT EXISTS ${META_TABLE} (
            hash TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )`
    )
    const appliedRows = database
        .prepare(`SELECT hash FROM ${META_TABLE} ORDER BY hash`)
        .all() as MigrationRecord[]
    const appliedMigrations = new Set(appliedRows.map((row) => row.hash))
    const recordMigration = database.prepare(
        `INSERT INTO ${META_TABLE} (hash) VALUES (?) ON CONFLICT(hash) DO NOTHING`
    )

    for (const file of files) {
        const hash = file.replace(/\.sql$/, '')
        if (appliedMigrations.has(hash)) continue

        if (hasLegacyMigrationSchema(database, hash)) {
            recordMigration.run(hash)
            continue
        }

        const sql = readFileSync(join(migrationsDir, file), 'utf-8')
        const applyMigration = database.transaction(() => {
            database.exec(sql)
            recordMigration.run(hash)
        })
        try {
            applyMigration()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            throw new Error(`迁移 ${hash} 失败: ${message}`)
        }
    }
}
