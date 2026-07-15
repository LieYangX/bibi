/**
 * 从 resources/icon.png 生成构建所需的图标文件
 * 输出到 build/ 目录（electron-builder 默认读取位置）
 * @author xiangwei
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import pngToIco from 'png-to-ico'
import pngjs from 'pngjs'

const { PNG } = pngjs

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const srcPng = resolve(root, 'resources', 'icon.png')
const outPng = resolve(root, 'build', 'icon.png')
const outIco = resolve(root, 'build', 'icon.ico')
const outIcns = resolve(root, 'build', 'icon.icns')

if (!existsSync(srcPng)) {
    console.error('❌ 未找到 resources/icon.png，请放置 1024x1024 PNG 图标')
    process.exit(1)
}

const srcBuf = readFileSync(srcPng)
const sourceImage = PNG.sync.read(srcBuf)
const iconSize = Math.max(sourceImage.width, sourceImage.height)
let iconPng = srcBuf

if (sourceImage.width !== sourceImage.height) {
    const squareImage = new PNG({ width: iconSize, height: iconSize })
    const offsetX = Math.floor((iconSize - sourceImage.width) / 2)
    const offsetY = Math.floor((iconSize - sourceImage.height) / 2)

    // 将非正方形源图居中补透明边，避免 Windows ICO 生成失败
    for (let row = 0; row < sourceImage.height; row++) {
        const sourceStart = row * sourceImage.width * 4
        const sourceEnd = sourceStart + sourceImage.width * 4
        const targetStart = ((row + offsetY) * iconSize + offsetX) * 4
        sourceImage.data.copy(squareImage.data, targetStart, sourceStart, sourceEnd)
    }
    iconPng = PNG.sync.write(squareImage)
    console.log(
        `已将 ${sourceImage.width}x${sourceImage.height} 源图补齐为 ${iconSize}x${iconSize}`
    )
}

// 写入 build/icon.png（electron-builder 跨平台用）
writeFileSync(outPng, iconPng)
console.log(`✅ build/icon.png (${iconPng.length} bytes)`)

// 生成 build/icon.ico（Windows）
try {
    const icoBuf = await pngToIco(iconPng)
    writeFileSync(outIco, icoBuf)
    console.log(`✅ build/icon.ico (${icoBuf.length} bytes)`)
} catch (e) {
    console.error('❌ ICO 生成失败:', e instanceof Error ? e.message : String(e))
    process.exit(1)
}

// build/icon.icns（macOS）— 保留原文件不动
if (existsSync(outIcns)) {
    console.log(`⏭️  build/icon.icns 已存在，跳过`)
} else {
    console.log('⏭️  macOS 图标（icon.icns）请用 iconutil 或 assets 工具生成')
}
