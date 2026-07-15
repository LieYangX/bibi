/**
 * 官方账单文件读取器
 * @author xiangwei
 */

import { readFileSync, statSync } from 'fs'
import { extname } from 'path'
import { TextDecoder } from 'util'
import { parse } from 'csv-parse/sync'
import type ExcelJS from 'exceljs'
import * as iconv from 'iconv-lite'
import type { ImportSource } from '@shared/types'
import type { BillCell, BillRecord } from './import-bill-parser'

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024
const MAX_XLSX_ENTRY_COUNT = 1_000
const MAX_XLSX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024

/**
 * 按账单来源读取官方文件
 *
 * @param filePath 文件路径
 * @param source 账单来源
 * @returns 文件二维记录
 * @author xiangwei
 */
export async function readImportFile(
    filePath: string,
    source: ImportSource
): Promise<BillRecord[]> {
    validateFileExtension(filePath, source)
    if (statSync(filePath).size > MAX_IMPORT_FILE_BYTES) {
        throw new Error('导入文件不能超过 10 MB')
    }
    return source === 'alipay' ? readAlipayCsv(filePath) : readWechatWorkbook(filePath)
}

/**
 * 读取支付宝 GB18030 CSV
 *
 * @param filePath 文件路径
 * @returns CSV 二维记录
 * @author xiangwei
 */
function readAlipayCsv(filePath: string): BillRecord[] {
    const buffer = readFileSync(filePath)
    const content = decodeCsv(buffer)
    return parse(content, {
        bom: true,
        relax_column_count: true,
        record_delimiter: ['\r\n', '\n', '\r'],
        skip_empty_lines: false
    }) as string[][]
}

/**
 * 读取微信 XLSX 的首个非空工作表
 *
 * @param filePath 文件路径
 * @returns 工作表二维记录
 * @author xiangwei
 */
async function readWechatWorkbook(filePath: string): Promise<BillRecord[]> {
    await validateXlsxArchive(filePath)
    const { default: ExcelJSRuntime } = await import('exceljs')
    const workbook = new ExcelJSRuntime.Workbook()
    await workbook.xlsx.readFile(filePath)
    const worksheet = workbook.worksheets.find((item) => item.actualRowCount > 0)
    if (!worksheet) return []

    const records: BillRecord[] = []
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {
        const row = worksheet.getRow(rowNumber)
        const record: BillRecord = []
        for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber++) {
            record.push(normalizeExcelValue(row.getCell(columnNumber)))
        }
        trimTrailingEmptyCells(record)
        records.push(record)
    }
    return records
}

/**
 * 在解压前校验 XLSX 中央目录，阻止 ZIP 炸弹耗尽内存
 *
 * @param filePath XLSX 文件路径
 * @author xiangwei
 */
async function validateXlsxArchive(filePath: string): Promise<void> {
    const { Open } = await import('unzipper')
    const directory = await Open.file(filePath)
    if (directory.files.length > MAX_XLSX_ENTRY_COUNT) {
        throw new Error(`XLSX 文件条目不能超过 ${MAX_XLSX_ENTRY_COUNT} 个`)
    }

    let totalUncompressedBytes = 0
    for (const entry of directory.files) {
        const entrySize = entry.uncompressedSize
        if (!Number.isSafeInteger(entrySize) || entrySize < 0) {
            throw new Error('XLSX 文件包含无效条目')
        }
        totalUncompressedBytes += entrySize
        if (totalUncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES) {
            throw new Error(
                `XLSX 解压后内容不能超过 ${MAX_XLSX_UNCOMPRESSED_BYTES / 1024 / 1024} MB`
            )
        }
    }
}

/**
 * 将 ExcelJS 单元格转换为稳定的基础类型
 *
 * @param cell ExcelJS 单元格
 * @returns 基础单元格值
 * @author xiangwei
 */
function normalizeExcelValue(cell: ExcelJS.Cell): BillCell {
    let fallbackText = ''
    try {
        fallbackText = cell.text
    } catch {
        // 合并区域的从属单元格可能没有可读取的主单元格文本
    }
    return normalizeUnknownExcelValue(cell.value, fallbackText)
}

/**
 * 递归提取公式、富文本和超链接单元格的显示值
 *
 * @param value ExcelJS 原始值
 * @param fallbackText 显示文本
 * @returns 基础单元格值
 * @author xiangwei
 */
function normalizeUnknownExcelValue(value: unknown, fallbackText: string): BillCell {
    if (value === null || value === undefined) return null
    if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
        return value
    }
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
    if (typeof value !== 'object') return fallbackText || String(value)

    const objectValue = value as Record<string, unknown>
    if ('result' in objectValue && objectValue.result !== undefined) {
        return normalizeUnknownExcelValue(objectValue.result, fallbackText)
    }
    if (Array.isArray(objectValue.richText)) {
        return objectValue.richText
            .map((part) =>
                typeof part === 'object' && part !== null && 'text' in part
                    ? String((part as Record<string, unknown>).text ?? '')
                    : ''
            )
            .join('')
    }
    if (typeof objectValue.text === 'string') return objectValue.text
    return fallbackText || null
}

/**
 * 移除行尾空单元格并保留中间列位置
 *
 * @param record 行记录
 * @author xiangwei
 */
function trimTrailingEmptyCells(record: BillRecord): void {
    while (record.length > 0 && record.at(-1) === null) record.pop()
}

/**
 * 优先识别 UTF-8，否则按支付宝官方 GB18030 解码
 *
 * @param buffer CSV 文件内容
 * @returns 解码文本
 * @author xiangwei
 */
function decodeCsv(buffer: Buffer): string {
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(buffer)
        return buffer.toString('utf-8')
    } catch {
        return iconv.decode(buffer, 'gb18030')
    }
}

/**
 * 校验来源对应的官方文件类型
 *
 * @param filePath 文件路径
 * @param source 账单来源
 * @author xiangwei
 */
function validateFileExtension(filePath: string, source: ImportSource): void {
    const extension = extname(filePath).toLowerCase()
    if (source === 'alipay' && extension !== '.csv') {
        throw new Error('支付宝账单仅支持 CSV 文件')
    }
    if (source === 'wechat' && extension !== '.xlsx') {
        throw new Error('微信账单仅支持 XLSX 文件')
    }
}
