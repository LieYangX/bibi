/**
 * 清理 onnxruntime-node 中非当前平台架构的原生二进制文件
 *
 * onnxruntime-node 打包了 darwin/linux/win32 各架构的 native 二进制，
 * 总计约 210 MB。本脚本仅保留当前平台的二进制，减少打包体积。
 *
 * 在 electron-builder 打包前调用，例如：
 *   node scripts/clean-onnxruntime.mjs && electron-builder --win
 *
 * @author xiangwei
 */

import { platform, arch, exit } from 'node:process'
import { existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const onnxRuntimeDir = join(__dirname, '..', 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6')

if (!existsSync(onnxRuntimeDir)) {
    console.log('[clean-onnxruntime] onnxruntime-node 未安装，跳过清理')
    exit(0)
}

const currentPlatform = platform // 'win32' | 'darwin' | 'linux'
const currentArch = arch // 'x64' | 'arm64'

let removedCount = 0
let removedSize = 0

/**
 * 递归计算目录大小
 * @returns {number}
 */
function calcDirSize(dirPath) {
    try {
        const entries = readdirSync(dirPath, { withFileTypes: true })
        let total = 0
        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name)
            if (entry.isDirectory()) {
                total += calcDirSize(fullPath)
            } else if (entry.isFile()) {
                total += statSync(fullPath).size
            }
        }
        return total
    } catch {
        return 0
    }
}

// 遍历所有平台目录
for (const platformDir of readdirSync(onnxRuntimeDir, { withFileTypes: true })) {
    if (!platformDir.isDirectory()) continue

    const platformPath = join(onnxRuntimeDir, platformDir.name)

    if (platformDir.name !== currentPlatform) {
        // 整个平台目录不是当前平台，全部删除
        const size = calcDirSize(platformPath)
        rmSync(platformPath, { recursive: true, force: true })
        removedCount++
        removedSize += size
        console.log(
            `[clean-onnxruntime] 已删除: ${platformDir.name}/ (${(size / 1024 / 1024).toFixed(1)} MB)`
        )
    } else {
        // 当前平台目录：只保留当前架构子目录
        for (const archDir of readdirSync(platformPath, { withFileTypes: true })) {
            if (!archDir.isDirectory()) continue

            const archPath = join(platformPath, archDir.name)

            if (archDir.name !== currentArch) {
                const size = calcDirSize(archPath)
                rmSync(archPath, { recursive: true, force: true })
                removedCount++
                removedSize += size
                console.log(
                    `[clean-onnxruntime] 已删除: ${platformDir.name}/${archDir.name} (${(size / 1024 / 1024).toFixed(1)} MB)`
                )
            }
        }
    }
}

const totalMb = (removedSize / 1024 / 1024).toFixed(1)
console.log(`[clean-onnxruntime] 清理完成，共移除 ${removedCount} 个目录，释放 ${totalMb} MB`)
