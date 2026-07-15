/**
 * 用户域请求代次
 * 用于阻止用户切换前发起的异步请求回写当前用户状态
 * @author xiangwei
 */

import type { IpcResult } from '@shared/types'

const STALE_REQUEST_ERROR = '用户会话已切换，请重试'

let currentGeneration = 0

/**
 * 捕获当前用户域请求代次
 *
 * @returns 当前请求代次
 * @author xiangwei
 */
export function captureUserRequestGeneration(): number {
    return currentGeneration
}

/**
 * 使此前发起的所有用户域请求失效
 *
 * @author xiangwei
 */
export function invalidateUserRequests(): void {
    currentGeneration++
}

/**
 * 判断请求是否仍属于当前用户会话
 *
 * @param generation 请求发起时捕获的代次
 * @returns 请求是否仍然有效
 * @author xiangwei
 */
export function isUserRequestCurrent(generation: number): boolean {
    return generation === currentGeneration
}

/**
 * 创建用户会话已切换的 IPC 失败结果
 *
 * @returns IPC 失败结果
 * @author xiangwei
 */
export function createStaleUserRequestResult<T = void>(): IpcResult<T> {
    return { ok: false, error: STALE_REQUEST_ERROR }
}
