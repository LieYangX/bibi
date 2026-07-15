import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import ExcelJS from 'exceljs'
import * as iconv from 'iconv-lite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseBillRecords } from '../../src/main/services/import-bill-parser'
import { readImportFile } from '../../src/main/services/import-file-reader'

const ALIPAY_HEADER = [
    '交易时间',
    '交易分类',
    '交易对方',
    '对方账号',
    '商品说明',
    '收/支',
    '金额',
    '收/付款方式',
    '交易状态',
    '交易订单号',
    '商家订单号',
    '备注'
]

const WECHAT_HEADER = [
    '交易时间',
    '交易类型',
    '交易对方',
    '商品',
    '收/支',
    '金额(元)',
    '支付方式',
    '当前状态',
    '交易单号',
    '商户单号',
    '备注'
]

const ZIP_CENTRAL_DIRECTORY_SIGNATURE = Buffer.from([0x50, 0x4b, 0x01, 0x02])
const ZIP_UNCOMPRESSED_SIZE_OFFSET = 24
const OVERSIZED_XLSX_ENTRY_BYTES = 101 * 1024 * 1024

describe('官方账单文件读取', () => {
    let fixtureDirectory: string

    beforeEach(() => {
        fixtureDirectory = mkdtempSync(join(tmpdir(), 'bibi-import-reader-'))
    })

    afterEach(() => {
        rmSync(fixtureDirectory, { recursive: true, force: true })
    })

    it('读取第 24 行表头的支付宝 GB18030 CSV', async () => {
        const filePath = join(fixtureDirectory, 'alipay.csv')
        const prefixLines = Array.from(
            { length: 23 },
            (_, index) => `支付宝账单脱敏说明 ${index + 1}`
        )
        const content = [
            ...prefixLines,
            ALIPAY_HEADER.join(','),
            [
                '2026-07-10 12:30:00',
                '餐饮美食',
                '示例餐厅',
                'merchant@example.com',
                '"奶茶,大杯"',
                '支出',
                '18.88',
                '余额宝&支付宝红包',
                '交易成功',
                '202607100000000001',
                'M20260710001',
                '脱敏备注'
            ].join(',')
        ].join('\r\n')
        writeFileSync(filePath, iconv.encode(content, 'gb18030'))

        const records = await readImportFile(filePath, 'alipay')
        const [row] = parseBillRecords(records, 'alipay')

        expect(records[23]).toEqual(ALIPAY_HEADER)
        expect(row).toMatchObject({
            type: 'expense',
            amount_cents: 1888,
            product: '奶茶,大杯',
            source_account_key: '余额宝',
            external_transaction_id: '202607100000000001'
        })
    })

    it('兼容支付宝 GB18030 CSV 中混合使用 CRLF、LF 和 CR 换行符', async () => {
        const filePath = join(fixtureDirectory, 'alipay-mixed-newlines.csv')
        const prefixLines = Array.from(
            { length: 23 },
            (_, index) => `支付宝账单脱敏说明 ${index + 1}`
        )
        const dataRow = [
            '2026-07-09 18:20:00',
            '日用百货',
            '示例便利店',
            'merchant@example.com',
            '生活用品',
            '支出',
            '23.50',
            '余额宝',
            '交易成功',
            '202607090000000001',
            'M20260709001',
            ''
        ].join(',')
        const lines = [...prefixLines, ALIPAY_HEADER.join(','), dataRow]
        const content = lines
            .map((line, index) => `${line}${['\r\n', '\n', '\r'][index % 3]}`)
            .join('')
        writeFileSync(filePath, iconv.encode(content, 'gb18030'))

        const records = await readImportFile(filePath, 'alipay')
        const [row] = parseBillRecords(records, 'alipay')

        expect(records[23]).toEqual(ALIPAY_HEADER)
        expect(row).toMatchObject({
            type: 'expense',
            amount_cents: 2350,
            source_category: '日用百货',
            external_transaction_id: '202607090000000001'
        })
    })

    it('读取第 18 行表头的微信 XLSX 并保留 Date、number 和字符串订单号', async () => {
        const filePath = join(fixtureDirectory, 'wechat.xlsx')
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('微信支付账单')
        worksheet.getCell('A1').value = '微信账单脱敏说明'
        worksheet.getRow(18).values = WECHAT_HEADER
        worksheet.getRow(19).values = [
            new Date('2026-07-11T08:30:00.000Z'),
            '二维码收付款',
            '客户乙',
            '服务费',
            '收入',
            66.6,
            '/',
            '已收钱',
            '0012345678901234567890',
            'merchant-003',
            '脱敏备注'
        ]
        await workbook.xlsx.writeFile(filePath)

        const records = await readImportFile(filePath, 'wechat')
        const [row] = parseBillRecords(records, 'wechat')

        expect(records[17]).toEqual(WECHAT_HEADER)
        expect(records[18][0]).toBeInstanceOf(Date)
        expect(records[18][5]).toBe(66.6)
        expect(records[18][8]).toBe('0012345678901234567890')
        expect(row).toMatchObject({
            type: 'income',
            date: '2026-07-11',
            amount_cents: 6660,
            source_account_key: '微信零钱',
            external_transaction_id: '0012345678901234567890'
        })
    })

    it('跳过微信 XLSX 表头前的合并说明行并定位第 18 行表头', async () => {
        const filePath = join(fixtureDirectory, 'wechat-merged-intro.xlsx')
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet('微信支付账单')
        worksheet.mergeCells('A1:K1')
        worksheet.getCell('A1').value = '微信支付账单明细证明'
        worksheet.mergeCells('A3:K4')
        worksheet.getCell('A3').value = '本账单仅用于个人对账'
        worksheet.getRow(18).values = WECHAT_HEADER
        worksheet.getRow(19).values = [
            new Date(2026, 6, 11, 0, 10),
            '商户消费',
            '示例超市',
            '日用品',
            '支出',
            12.34,
            '零钱',
            '支付成功',
            '0012345678901234567891',
            'merchant-004',
            ''
        ]
        await workbook.xlsx.writeFile(filePath)

        const records = await readImportFile(filePath, 'wechat')
        const [row] = parseBillRecords(records, 'wechat')

        expect(records[17]).toEqual(WECHAT_HEADER)
        expect(row).toMatchObject({
            type: 'expense',
            date: '2026-07-11',
            amount_cents: 1234,
            source_account_key: '零钱',
            external_transaction_id: '0012345678901234567891'
        })
    })

    it('按来源拒绝错误文件类型', async () => {
        await expect(
            readImportFile(join(fixtureDirectory, 'wrong.xlsx'), 'alipay')
        ).rejects.toThrow('支付宝账单仅支持 CSV 文件')
        await expect(readImportFile(join(fixtureDirectory, 'wrong.csv'), 'wechat')).rejects.toThrow(
            '微信账单仅支持 XLSX 文件'
        )
    })

    it('在 ExcelJS 解压前拒绝声明超大解压体积的 XLSX', async () => {
        const filePath = join(fixtureDirectory, 'oversized.xlsx')
        const workbook = new ExcelJS.Workbook()
        workbook.addWorksheet('账单').getCell('A1').value = '测试'
        await workbook.xlsx.writeFile(filePath)

        const archive = readFileSync(filePath)
        const centralDirectoryOffset = archive.indexOf(ZIP_CENTRAL_DIRECTORY_SIGNATURE)
        expect(centralDirectoryOffset).toBeGreaterThanOrEqual(0)
        archive.writeUInt32LE(
            OVERSIZED_XLSX_ENTRY_BYTES,
            centralDirectoryOffset + ZIP_UNCOMPRESSED_SIZE_OFFSET
        )
        writeFileSync(filePath, archive)

        await expect(readImportFile(filePath, 'wechat')).rejects.toThrow(
            'XLSX 解压后内容不能超过 100 MB'
        )
    })
})
