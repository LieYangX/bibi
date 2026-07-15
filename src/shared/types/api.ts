/**
 * 共享类型定义 - API 响应包装
 * @author xiangwei
 */

export interface IpcSuccess<T> {
    ok: true
    data: T
    /** 可用于关联本次成功调用主进程日志的排查编号 */
    traceId?: string
}

export interface IpcFailure {
    ok: false
    error: string
    /** 可用于检索本地日志的排查编号 */
    traceId?: string
}

export type IpcResult<T = void> = IpcSuccess<T> | IpcFailure
