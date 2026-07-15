/**
 * 迁移目录路径
 * 打包后 __dirname 会指向主进程输出根目录，因此需要显式定位 migrations 子目录
 * @author xiangwei
 */

import { join } from 'path'

/**
 * 获取迁移 SQL 文件所在目录
 * 开发时指向 src/main/database/drizzle/migrations
 * 生产构建后指向 out/main/database/drizzle/migrations
 *
 * @returns migrations 目录绝对路径
 */
export function getMigrationsDir(): string {
    // 在打包后的主进程中，__dirname 通常是 out/main
    return join(__dirname, 'database', 'drizzle', 'migrations')
}

/** 默认迁移目录 */
export const migrationsDir = getMigrationsDir()
