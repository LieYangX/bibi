import { resolve, join } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs'

/** 将迁移 SQL 文件复制到输出目录 */
function doCopyMigrationFiles(): void {
    const srcDir = resolve(__dirname, 'src/main/database/drizzle/migrations')
    const outDir = resolve(__dirname, 'out/main/database/drizzle/migrations')
    if (!existsSync(srcDir)) {
        console.log('[copy-migration-files] 源目录不存在，跳过')
        return
    }
    mkdirSync(outDir, { recursive: true })
    const files = readdirSync(srcDir).filter((f) => f.endsWith('.sql'))
    for (const file of files) {
        copyFileSync(join(srcDir, file), join(outDir, file))
        console.log(`[copy-migration-files] 已复制 ${file}`)
    }
}

/** 构建或开发模式下复制迁移 SQL 文件 */
function copyMigrationPlugin(): {
    name: string
    writeBundle: () => void
    buildStart: () => void
} {
    return {
        name: 'copy-migration-files',
        writeBundle() {
            doCopyMigrationFiles()
        },
        buildStart() {
            doCopyMigrationFiles()
        }
    }
}

export default defineConfig({
    main: {
        resolve: {
            alias: {
                '@shared': resolve('src/shared'),
                // npm 1.2.0 包缺少声明中的 dist 目录，直接打包官方 SDK 源码。
                '@pinixai/weixin-bot': resolve('node_modules/@pinixai/weixin-bot/src/index.ts')
            }
        },
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/main/index.ts'),
                    'workers/stt.worker': resolve(__dirname, 'src/main/workers/stt.worker.ts')
                }
            }
        },
        plugins: [
            externalizeDepsPlugin({ exclude: ['@pinixai/weixin-bot'] }),
            copyMigrationPlugin()
        ]
    },
    preload: {
        resolve: {
            alias: {
                '@shared': resolve('src/shared')
            }
        },
        plugins: [externalizeDepsPlugin()]
    },
    renderer: {
        resolve: {
            alias: {
                '@renderer': resolve('src/renderer/src'),
                '@shared': resolve('src/shared')
            }
        },
        plugins: [vue()]
    }
})
