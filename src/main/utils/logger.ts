/**
 * 主进程统一日志工具
 *
 * 日志使用 JSON Lines 格式写入本地文件，并通过异步上下文自动携带请求链路信息。
 *
 * @author xiangwei
 */

import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { sanitizeLogData } from './log-sanitizer'

const LOG_FILE_NAME = 'bibi.log'
const MAX_LOG_FILE_BYTES = 5 * 1024 * 1024
const RETAINED_LOG_FILE_COUNT = 7
const LOG_PROCESS = 'main'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'DB'

/** 日志链路上下文 */
export interface LogContext {
    traceId?: string
    parentTraceId?: string
    userId?: string
    conversationId?: string
    channel?: string
    operation?: string
    webContentsId?: number
}

/** 日志目录信息 */
export interface LogDirectoryInfo {
    directory: string
    currentFile: string
    maxFileSizeMb: number
    retainedFileCount: number
}

const logContextStorage = new AsyncLocalStorage<LogContext>()
const sessionId = randomUUID()
let logDirectory = ''
let currentLogSize = -1

/**
 * 获取日志目录
 *
 * @returns 日志目录绝对路径
 * @author xiangwei
 */
export function getLogDirectory(): string {
    if (!logDirectory) {
        logDirectory = app.isPackaged
            ? join(app.getPath('userData'), 'logs')
            : join(app.getAppPath(), 'logs')
        if (!existsSync(logDirectory)) mkdirSync(logDirectory, { recursive: true })
    }
    return logDirectory
}

/**
 * 获取当前日志文件路径
 *
 * @returns 当前日志文件绝对路径
 * @author xiangwei
 */
export function getLogPath(): string {
    return join(getLogDirectory(), LOG_FILE_NAME)
}

/**
 * 获取日志目录配置
 *
 * @returns 日志目录配置
 * @author xiangwei
 */
export function getLogDirectoryInfo(): LogDirectoryInfo {
    return {
        directory: getLogDirectory(),
        currentFile: getLogPath(),
        maxFileSizeMb: MAX_LOG_FILE_BYTES / 1024 / 1024,
        retainedFileCount: RETAINED_LOG_FILE_COUNT
    }
}

/**
 * 创建便于检索的链路编号
 *
 * @param prefix 编号前缀
 * @returns 链路编号
 * @author xiangwei
 */
export function createTraceId(prefix: string = 'trace'): string {
    return `${prefix}-${randomUUID()}`
}

/**
 * 获取当前异步链路上下文
 *
 * @returns 当前上下文
 * @author xiangwei
 */
export function getLogContext(): Readonly<LogContext> {
    return logContextStorage.getStore() ?? {}
}

/**
 * 在指定日志上下文中执行业务逻辑
 *
 * @param context 本次追加的上下文
 * @param callback 业务回调
 * @returns 回调执行结果
 * @author xiangwei
 */
export function runWithLogContext<TResult>(context: LogContext, callback: () => TResult): TResult {
    return logContextStorage.run({ ...getLogContext(), ...context }, callback)
}

/**
 * 读取当前日志文件大小
 *
 * @param logPath 日志文件路径
 * @returns 文件字节数
 * @author xiangwei
 */
function readCurrentLogSize(logPath: string): number {
    if (!existsSync(logPath)) return 0
    try {
        return statSync(logPath).size
    } catch {
        return 0
    }
}

/**
 * 按文件大小轮转日志
 *
 * @param incomingBytes 待写入字节数
 * @author xiangwei
 */
function rotateLogsIfNeeded(incomingBytes: number): void {
    const logPath = getLogPath()
    if (currentLogSize < 0) currentLogSize = readCurrentLogSize(logPath)
    if (currentLogSize + incomingBytes <= MAX_LOG_FILE_BYTES) return

    try {
        const oldestPath = `${logPath}.${RETAINED_LOG_FILE_COUNT - 1}`
        if (existsSync(oldestPath)) unlinkSync(oldestPath)
        for (let index = RETAINED_LOG_FILE_COUNT - 2; index >= 1; index--) {
            const sourcePath = `${logPath}.${index}`
            if (existsSync(sourcePath)) renameSync(sourcePath, `${logPath}.${index + 1}`)
        }
        if (existsSync(logPath)) renameSync(logPath, `${logPath}.1`)
        currentLogSize = 0
    } catch (error: unknown) {
        console.error('[Logger] 日志轮转失败', error)
        currentLogSize = readCurrentLogSize(logPath)
    }
}

/**
 * 输出开发控制台日志
 *
 * @param level 日志级别
 * @param line 日志文本
 * @author xiangwei
 */
function writeConsole(level: LogLevel, line: string): void {
    if (level === 'ERROR') {
        console.error(line)
        return
    }
    if (level === 'WARN') {
        console.warn(line)
        return
    }
    console.log(line)
}

/**
 * 写入单条结构化日志
 *
 * @param level 日志级别
 * @param tag 模块标签
 * @param message 日志信息
 * @param data 附加数据
 * @author xiangwei
 */
function write(level: LogLevel, tag: string, message: string, data?: unknown): void {
    const context = getLogContext()
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        process: LOG_PROCESS,
        sessionId,
        ...context,
        tag,
        message,
        ...(data === undefined ? {} : { data: sanitizeLogData(data) })
    }
    const line = `${JSON.stringify(entry)}\n`
    const lineBytes = Buffer.byteLength(line, 'utf8')

    writeConsole(level, line.trimEnd())
    try {
        rotateLogsIfNeeded(lineBytes)
        appendFileSync(getLogPath(), line, 'utf8')
        currentLogSize += lineBytes
    } catch (error: unknown) {
        console.error('[Logger] 日志写入失败', error)
    }
}

export const logger = {
    debug(tag: string, message: string, data?: unknown): void {
        write('DEBUG', tag, message, data)
    },
    info(tag: string, message: string, data?: unknown): void {
        write('INFO', tag, message, data)
    },
    warn(tag: string, message: string, data?: unknown): void {
        write('WARN', tag, message, data)
    },
    error(tag: string, message: string, data?: unknown): void {
        write('ERROR', tag, message, data)
    },
    db(tag: string, sql: string, params?: unknown[]): void {
        const statement = sql.replace(/\s+/g, ' ').trim().substring(0, 500)
        write('DB', tag, statement, { parameterCount: params?.length ?? 0 })
    }
}
