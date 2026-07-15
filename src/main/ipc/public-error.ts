/**
 * IPC 公开错误映射
 * @author xiangwei
 */

import { z } from 'zod'

const SQLITE_ERROR_NAME = 'SqliteError'

/**
 * 判断异常是否携带 Node.js 系统错误码
 *
 * @param error 异常
 * @returns 是否为系统基础设施错误
 * @author xiangwei
 */
function hasSystemErrorCode(error: Error): error is NodeJS.ErrnoException {
    return typeof (error as NodeJS.ErrnoException).code === 'string'
}

/**
 * 将异常转换为用户可读且不泄露基础设施信息的文案
 *
 * @param error 异常
 * @param fallback 默认错误信息
 * @returns 用户可读信息
 * @author xiangwei
 */
export function getPublicErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof z.ZodError) {
        return `请求参数无效: ${error.issues[0]?.message || '格式错误'}`
    }
    if (!(error instanceof Error)) return fallback
    if (error.name === SQLITE_ERROR_NAME || hasSystemErrorCode(error)) return fallback
    return error.message
}
