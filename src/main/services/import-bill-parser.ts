/**
 * 支付宝与微信账单纯解析器
 * @author xiangwei
 */

import type { ImportItemType, ImportSource } from '@shared/types'

export type BillCell = string | number | Date | null
export type BillRecord = BillCell[]

export interface ParsedBillRow {
    type: ImportItemType
    default_included: boolean
    exclusion_reason: string | null
    date: string
    amount_cents: number
    note: string
    source_category: string
    source_transaction_type: string
    source_direction: string
    source_status: string
    source_account_raw: string
    source_account_key: string
    counterparty: string
    product: string
    external_transaction_id: string
}

type BillField =
    | 'date'
    | 'category'
    | 'transactionType'
    | 'counterparty'
    | 'product'
    | 'direction'
    | 'amount'
    | 'account'
    | 'status'
    | 'transactionId'
    | 'remark'

interface SourceConfig {
    displayName: string
    fileType: string
    aliases: Record<BillField, readonly string[]>
    requiredFields: readonly BillField[]
}

interface HeaderLocation {
    rowIndex: number
    indexes: Partial<Record<BillField, number>>
}

const COMMON_ALIASES = {
    date: ['交易时间', '交易日期', '交易创建时间'],
    counterparty: ['交易对方', '对方'],
    direction: ['收/支', '收／支', '收支'],
    remark: ['备注']
} as const

const SOURCE_CONFIGS: Record<ImportSource, SourceConfig> = {
    alipay: {
        displayName: '支付宝',
        fileType: 'CSV',
        aliases: {
            date: COMMON_ALIASES.date,
            category: ['交易分类'],
            transactionType: ['交易类型', '类型'],
            counterparty: COMMON_ALIASES.counterparty,
            product: ['商品说明', '商品名称', '商品'],
            direction: COMMON_ALIASES.direction,
            amount: ['金额', '金额(元)', '金额（元）', '交易金额', '交易金额(元)'],
            account: [
                '收/付款方式',
                '收／付款方式',
                '付款方式',
                '收款方式',
                '支付方式',
                '资金渠道'
            ],
            status: ['交易状态', '当前状态'],
            transactionId: ['交易订单号', '交易单号', '交易号'],
            remark: COMMON_ALIASES.remark
        },
        requiredFields: ['date', 'category', 'direction', 'amount']
    },
    wechat: {
        displayName: '微信',
        fileType: 'XLSX',
        aliases: {
            date: COMMON_ALIASES.date,
            category: ['交易分类'],
            transactionType: ['交易类型', '类型'],
            counterparty: COMMON_ALIASES.counterparty,
            product: ['商品', '商品说明', '商品名称'],
            direction: COMMON_ALIASES.direction,
            amount: ['金额(元)', '金额（元）', '金额', '交易金额(元)'],
            account: ['支付方式', '收/付款方式', '收／付款方式', '付款方式', '收款方式'],
            status: ['当前状态', '交易状态'],
            transactionId: ['交易单号', '交易订单号', '交易号'],
            remark: COMMON_ALIASES.remark
        },
        requiredFields: ['date', 'transactionType', 'direction', 'amount']
    }
}

const EXCLUDED_STATUS_PATTERN = /(关闭|失败|已取消|已撤销|待付款|等待付款|处理中)/u
const ALIPAY_DISCOUNT_ACCOUNT_PATTERN =
    /^(?:(?:支付宝|商家|平台)?(?:红包|优惠|优惠券|消费券|代金券|立减金|奖励金|积分|积分抵扣)(?:[\d.]+元)?|.*(?:立减|神券).*)$/u

/**
 * 按账单来源和动态表头解析记录
 *
 * @param records 文件二维记录
 * @param source 账单来源
 * @returns 标准化账单记录
 * @author xiangwei
 */
export function parseBillRecords(records: BillRecord[], source: ImportSource): ParsedBillRow[] {
    const config = SOURCE_CONFIGS[source]
    const header = locateHeader(records, config)
    const parsedRows: ParsedBillRow[] = []

    for (const row of records.slice(header.rowIndex + 1)) {
        const date = normalizeDate(readField(row, header.indexes.date))
        const amountCents = parseAmountCents(readField(row, header.indexes.amount))
        if (!date || amountCents === null) continue

        parsedRows.push(parseDataRow(row, header.indexes, source, date, amountCents))
    }

    return parsedRows
}

/**
 * 解析一条有效数据行
 *
 * @param row 原始数据行
 * @param indexes 字段下标
 * @param source 账单来源
 * @param date 标准日期
 * @param amountCents 金额分
 * @returns 标准账单行
 * @author xiangwei
 */
function parseDataRow(
    row: BillRecord,
    indexes: HeaderLocation['indexes'],
    source: ImportSource,
    date: string,
    amountCents: number
): ParsedBillRow {
    const sourceDirection = readText(row, indexes.direction, 50)
    const sourceTransactionType = readText(row, indexes.transactionType, 100)
    const rawCategory = readText(row, indexes.category, 100)
    const sourceCategory = (
        rawCategory || (source === 'wechat' ? sourceTransactionType : '')
    ).slice(0, 50)
    const sourceStatus = readText(row, indexes.status, 100)
    const sourceAccountRaw = readText(row, indexes.account, 200)
    const counterparty = readText(row, indexes.counterparty, 200)
    const product = readText(row, indexes.product, 300)
    const baseType = resolveItemType(
        source,
        sourceDirection,
        sourceCategory,
        sourceTransactionType,
        sourceStatus
    )
    const exclusionReason =
        amountCents === 0
            ? '金额为 0'
            : resolveExclusionReason(baseType, sourceDirection, sourceStatus)
    const type = exclusionReason ? 'skip' : baseType

    return {
        type,
        default_included: type !== 'skip',
        exclusion_reason: exclusionReason,
        date,
        amount_cents: amountCents,
        note: buildNote(row, indexes),
        source_category: sourceCategory,
        source_transaction_type: sourceTransactionType,
        source_direction: sourceDirection,
        source_status: sourceStatus,
        source_account_raw: sourceAccountRaw,
        source_account_key: normalizeAccountKey(source, sourceAccountRaw, baseType),
        counterparty,
        product,
        external_transaction_id: readText(row, indexes.transactionId, 200)
    }
}

/**
 * 定位账单表头并建立字段下标
 *
 * @param records 文件二维记录
 * @param config 来源配置
 * @returns 表头位置
 * @author xiangwei
 */
function locateHeader(records: BillRecord[], config: SourceConfig): HeaderLocation {
    for (const [rowIndex, row] of records.entries()) {
        const indexes = locateFieldIndexes(row, config.aliases)
        if (config.requiredFields.every((field) => indexes[field] !== undefined)) {
            return { rowIndex, indexes }
        }
    }

    throw new Error(
        `未找到${config.displayName}账单必要表头，请确认文件为官方 ${config.fileType} 账单`
    )
}

/**
 * 根据表头别名查找字段下标
 *
 * @param headerRow 表头行
 * @param aliases 字段别名
 * @returns 字段下标
 * @author xiangwei
 */
function locateFieldIndexes(
    headerRow: BillRecord,
    aliases: SourceConfig['aliases']
): Partial<Record<BillField, number>> {
    const normalizedHeaders = headerRow.map(normalizeHeader)
    const indexes: Partial<Record<BillField, number>> = {}

    for (const field of Object.keys(aliases) as BillField[]) {
        const acceptedHeaders = new Set(aliases[field].map(normalizeHeader))
        const index = normalizedHeaders.findIndex((header) => acceptedHeaders.has(header))
        if (index >= 0) indexes[field] = index
    }

    return indexes
}

/**
 * 根据来源字段判断收支类型
 *
 * @param source 账单来源
 * @param direction 原始收支方向
 * @param category 原始分类
 * @param transactionType 原始交易类型
 * @param status 原始状态
 * @returns 收支类型
 * @author xiangwei
 */
function resolveItemType(
    source: ImportSource,
    direction: string,
    category: string,
    transactionType: string,
    status: string
): ImportItemType {
    const normalizedDirection = normalizeLabel(direction)
    const isAlipayRefund =
        source === 'alipay' &&
        normalizeLabel(status).includes('退款成功') &&
        [category, transactionType].some((value) => normalizeLabel(value) === '退款')
    if (isAlipayRefund) return 'income'
    if (normalizedDirection === '收入') return 'income'
    if (normalizedDirection === '支出') return 'expense'
    return 'skip'
}

/**
 * 计算默认排除原因
 *
 * @param type 基础收支类型
 * @param direction 原始收支方向
 * @param status 原始交易状态
 * @returns 默认排除原因，无需排除时返回 null
 * @author xiangwei
 */
function resolveExclusionReason(
    type: ImportItemType,
    direction: string,
    status: string
): string | null {
    if (EXCLUDED_STATUS_PATTERN.test(normalizeLabel(status))) {
        return status ? `交易状态为“${status}”` : '交易已关闭或失败'
    }
    if (type === 'skip') {
        const normalizedDirection = normalizeLabel(direction)
        return normalizedDirection === '不计收支' || normalizedDirection === '中性交易'
            ? '不计收支'
            : '无法识别收支方向'
    }
    return null
}

/**
 * 规范化来源账户键
 *
 * @param source 账单来源
 * @param accountRaw 原始账户
 * @param type 基础收支类型
 * @returns 可用于账户映射的键
 * @author xiangwei
 */
function normalizeAccountKey(
    source: ImportSource,
    accountRaw: string,
    type: ImportItemType
): string {
    if (source === 'wechat') {
        return (accountRaw === '/' && type === 'income' ? '微信零钱' : accountRaw).slice(0, 100)
    }

    const primaryAccount = cleanCell(accountRaw.split(/[&＆]/u, 1)[0] ?? '')
    if (!primaryAccount || primaryAccount === '/') return ''
    const normalizedAccount = primaryAccount.replace(/\s+/gu, '')
    return ALIPAY_DISCOUNT_ACCOUNT_PATTERN.test(normalizedAccount)
        ? ''
        : primaryAccount.slice(0, 100)
}

/**
 * 将账单金额精确转换为整数分并按第三位小数四舍五入
 *
 * @param rawAmount 原始金额
 * @returns 整数分，格式无效时返回 null
 * @author xiangwei
 */
function parseAmountCents(rawAmount: BillCell): number | null {
    if (rawAmount instanceof Date || rawAmount === null) return null
    if (typeof rawAmount === 'number' && !Number.isFinite(rawAmount)) return null

    const normalized = cleanCell(rawAmount)
        .replace(/[¥￥,，\s]/g, '')
        .replace(/元$/u, '')
    const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d*))?$/)
    if (!match) return null

    const fraction = match[3] ?? ''
    const centDigits = fraction.padEnd(2, '0').slice(0, 2)
    let cents = BigInt(match[2]) * 100n + BigInt(centDigits || '0')
    if ((fraction[2] ?? '0') >= '5') cents++
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null

    return Number(cents)
}

/**
 * 将账单日期格式化为 YYYY-MM-DD
 *
 * @param rawDate 原始日期
 * @returns 标准日期，格式无效时返回 null
 * @author xiangwei
 */
function normalizeDate(rawDate: BillCell): string | null {
    if (rawDate instanceof Date) {
        if (Number.isNaN(rawDate.getTime())) return null
        return formatDate(rawDate.getFullYear(), rawDate.getMonth() + 1, rawDate.getDate())
    }
    if (rawDate === null) return null

    const match = cleanCell(rawDate).match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/u)
    if (!match) return null
    return formatDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

/**
 * 校验并格式化年月日
 *
 * @param year 年
 * @param month 月
 * @param day 日
 * @returns 标准日期，日期无效时返回 null
 * @author xiangwei
 */
function formatDate(year: number, month: number, day: number): string | null {
    const date = new Date(Date.UTC(year, month - 1, day))
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return null
    }

    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 拼接交易对方、商品和备注，并移除重复内容
 *
 * @param row 数据行
 * @param indexes 字段下标
 * @returns 账单备注
 * @author xiangwei
 */
function buildNote(row: BillRecord, indexes: HeaderLocation['indexes']): string {
    const noteParts = [indexes.counterparty, indexes.product, indexes.remark]
        .map((index) => cleanCell(readField(row, index)))
        .filter(Boolean)
    return Array.from(new Set(noteParts)).join(' · ').slice(0, 500)
}

/**
 * 读取并截断文本字段
 *
 * @param row 数据行
 * @param index 列下标
 * @param maxLength 最大长度
 * @returns 清理后的文本
 * @author xiangwei
 */
function readText(row: BillRecord, index: number | undefined, maxLength: number): string {
    return cleanCell(readField(row, index)).slice(0, maxLength)
}

/**
 * 读取指定列，缺失时返回 null
 *
 * @param row 数据行
 * @param index 列下标
 * @returns 单元格内容
 * @author xiangwei
 */
function readField(row: BillRecord, index: number | undefined): BillCell {
    return index === undefined ? null : (row[index] ?? null)
}

/**
 * 规范化表头以兼容 BOM、空白和全角括号
 *
 * @param value 表头内容
 * @returns 规范化表头
 * @author xiangwei
 */
function normalizeHeader(value: BillCell): string {
    return cleanCell(value)
        .replace(/^\uFEFF/u, '')
        .replace(/\s+/gu, '')
        .replace(/[（）]/gu, (character) => (character === '（' ? '(' : ')'))
        .toLowerCase()
}

/**
 * 规范化用于规则判断的文本
 *
 * @param value 原始文本
 * @returns 去除空白后的文本
 * @author xiangwei
 */
function normalizeLabel(value: string): string {
    return value.replace(/\s+/gu, '')
}

/**
 * 清理单元格首尾及连续空白
 *
 * @param value 单元格内容
 * @returns 清理后的内容
 * @author xiangwei
 */
function cleanCell(value: BillCell): string {
    if (value === null) return ''
    const text = value instanceof Date ? value.toISOString() : String(value)
    const normalized = text
        .replace(/^\uFEFF/u, '')
        .trim()
        .replace(/\s+/gu, ' ')
    return normalized.startsWith("'") && normalized.endsWith("'")
        ? normalized.slice(1, -1).trim()
        : normalized
}
