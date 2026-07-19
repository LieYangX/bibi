import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../../src/main/database/drizzle/migrations'

const migrationsDir = resolve('src/main/database/drizzle/migrations')

describe('SQLite 迁移与驱动契约', () => {
    it('迁移后可以安全读写包含 EOF 的文本', () => {
        const database = new Database(':memory:')
        runMigrations(database, migrationsDir)

        database
            .prepare('INSERT INTO users (id, name, color) VALUES (?, ?, ?)')
            .run('user-1', '备注 EOF 文本', '#fff')
        const row = database.prepare('SELECT name FROM users WHERE id = ?').get('user-1') as {
            name: string
        }

        expect(row.name).toBe('备注 EOF 文本')
        expect(database.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
        expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
        database.close()
    })

    it('迁移失败时回滚已执行的前置语句且不记录版本', () => {
        const directory = mkdtempSync(join(tmpdir(), 'bibi-migrations-'))
        writeFileSync(
            join(directory, '0000_bad.sql'),
            'CREATE TABLE should_rollback (id TEXT PRIMARY KEY);\nCREATE TABLE ;',
            'utf-8'
        )
        const database = new Database(':memory:')

        expect(() => runMigrations(database, directory)).toThrow()
        expect(
            database
                .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
                .get('should_rollback')
        ).toBeUndefined()
        expect(
            database.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get()
        ).toEqual({
            count: 0
        })

        database.close()
        rmSync(directory, { recursive: true, force: true })
    })

    it('旧版本缺少元数据时只在结构完整的情况下建立基线', () => {
        const database = new Database(':memory:')
        runMigrations(database, migrationsDir)
        database.prepare('DELETE FROM __drizzle_migrations').run()

        expect(() => runMigrations(database, migrationsDir)).not.toThrow()
        expect(
            database.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get()
        ).toEqual({ count: 12 })
        database.close()
    })
})
