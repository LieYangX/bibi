/**
 * 日志数据脱敏与序列化工具
 *
 * @author xiangwei
 */

const MAX_LOG_STRING_LENGTH = 2_000
const MAX_ERROR_STACK_LENGTH = 8_000
const MAX_COLLECTION_ITEMS = 50
const MAX_OBJECT_DEPTH = 6
const REDACTED_VALUE = '[已脱敏]'
const TRUNCATED_VALUE = '[内容已截断]'

const SENSITIVE_KEYS = new Set([
    'apikey',
    'authorization',
    'password',
    'secret',
    'accesstoken',
    'refreshtoken',
    'cookie',
    'setcookie',
    'privatekey'
])

/**
 * 判断字段名是否属于敏感信息
 *
 * @param key 字段名
 * @returns 是否需要脱敏
 * @author xiangwei
 */
function isSensitiveKey(key: string): boolean {
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
    return SENSITIVE_KEYS.has(normalized)
}

/**
 * 截断过长字符串，防止单条日志异常膨胀
 *
 * @param value 原始字符串
 * @param maxLength 最大长度
 * @returns 处理后的字符串
 * @author xiangwei
 */
function truncateString(value: string, maxLength: number = MAX_LOG_STRING_LENGTH): string {
    if (value.length <= maxLength) return value
    return `${value.slice(0, maxLength)}${TRUNCATED_VALUE}`
}

/**
 * 将异常转换为可落盘的结构化数据
 *
 * @param error 异常对象
 * @param seen 已访问对象集合
 * @returns 结构化异常
 * @author xiangwei
 */
function serializeError(error: Error, seen: WeakSet<object>): Record<string, unknown> {
    const serialized: Record<string, unknown> = {
        name: error.name,
        message: truncateString(error.message)
    }

    if (error.stack) {
        serialized.stack = truncateString(error.stack, MAX_ERROR_STACK_LENGTH)
    }

    if ('cause' in error && error.cause !== undefined) {
        serialized.cause = sanitizeValue(error.cause, 'cause', 1, seen)
    }

    return serialized
}

/**
 * 递归清洗日志数据
 *
 * @param value 原始数据
 * @param key 当前字段名
 * @param depth 当前递归深度
 * @param seen 已访问对象集合
 * @returns 可安全序列化的数据
 * @author xiangwei
 */
function sanitizeValue(value: unknown, key: string, depth: number, seen: WeakSet<object>): unknown {
    if (isSensitiveKey(key)) return REDACTED_VALUE
    if (value === null || value === undefined) return value ?? null
    if (typeof value === 'string') return truncateString(value)
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'symbol' || typeof value === 'function') return String(value)
    if (depth >= MAX_OBJECT_DEPTH) return '[达到最大层级]'
    if (value instanceof Date) return value.toISOString()
    if (value instanceof Error) return serializeError(value, seen)
    if (value instanceof ArrayBuffer) return { type: 'ArrayBuffer', byteLength: value.byteLength }
    if (ArrayBuffer.isView(value)) {
        return { type: value.constructor.name, byteLength: value.byteLength }
    }
    if (typeof value !== 'object') return String(value)
    if (seen.has(value)) return '[循环引用]'

    seen.add(value)
    try {
        if (Array.isArray(value)) {
            const items = value
                .slice(0, MAX_COLLECTION_ITEMS)
                .map((item, index) => sanitizeValue(item, String(index), depth + 1, seen))
            if (value.length > MAX_COLLECTION_ITEMS) {
                items.push(`[省略 ${value.length - MAX_COLLECTION_ITEMS} 项]`)
            }
            return items
        }

        const entries = Object.entries(value).slice(0, MAX_COLLECTION_ITEMS)
        const result: Record<string, unknown> = {}
        for (const [entryKey, entryValue] of entries) {
            result[entryKey] = sanitizeValue(entryValue, entryKey, depth + 1, seen)
        }
        const omittedCount = Object.keys(value).length - entries.length
        if (omittedCount > 0) result._omittedFields = omittedCount
        return result
    } finally {
        seen.delete(value)
    }
}

/**
 * 清洗任意日志数据
 *
 * @param value 原始数据
 * @returns 可安全写入日志的数据
 * @author xiangwei
 */
export function sanitizeLogData(value: unknown): unknown {
    return sanitizeValue(value, '', 0, new WeakSet<object>())
}

/**
 * 生成值的轻量结构摘要，不记录具体业务内容
 *
 * @param value 原始值
 * @returns 结构摘要
 * @author xiangwei
 */
export function summarizeLogValue(value: unknown): Record<string, unknown> {
    if (value === null) return { type: 'null' }
    if (Array.isArray(value)) return { type: 'array', itemCount: value.length }
    if (value instanceof ArrayBuffer) {
        return { type: 'ArrayBuffer', byteLength: value.byteLength }
    }
    if (ArrayBuffer.isView(value)) {
        return { type: value.constructor.name, byteLength: value.byteLength }
    }
    if (typeof value === 'object') {
        return { type: 'object', keys: Object.keys(value).sort().slice(0, MAX_COLLECTION_ITEMS) }
    }
    if (typeof value === 'string') return { type: 'string', length: value.length }
    return { type: typeof value }
}
