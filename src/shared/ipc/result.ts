/**
 * IPC 响应构造工具
 * @author xiangwei
 */

import type { IpcResult } from '../types/api'

/**
 * 创建结构稳定的 IPC 成功响应
 *
 * `data` 始终存在，使无返回值和允许返回 `undefined` 的接口都与类型声明一致。
 *
 * @param data 返回数据
 * @param traceId 日志排查编号
 * @returns IPC 成功响应
 * @author xiangwei
 */
export function createIpcSuccess<T>(data: T, traceId?: string): IpcResult<T> {
    return {
        ok: true,
        data,
        ...(traceId ? { traceId } : {})
    }
}
