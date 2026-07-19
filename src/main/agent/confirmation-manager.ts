/**
 * 工具操作确认管理器
 * 让危险工具（executeCommand / editFile）在执行前请求用户确认
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import type { AgentRunContext } from './agent-run-context'
import type { ConfirmationDetail } from '@shared/types'

/** 待处理的确认请求 */
interface PendingConfirmation {
    resolve: (approved: boolean) => void
    reject: (error: Error) => void
    timeout: ReturnType<typeof setTimeout>
}

const pendingConfirmations = new Map<string, PendingConfirmation>()

/** 确认超时时间（2 分钟） */
const CONFIRMATION_TIMEOUT_MS = 120_000

/**
 * 请求用户确认一个危险操作
 * 会向渲染进程发送 confirmation_request 事件，并等待用户响应
 *
 * @param ctx Agent 运行时上下文
 * @param detail 确认详情
 * @returns 用户是否确认（true=确认，false=拒绝）
 * @throws 超时或上下文失效时抛出异常
 * @author xiangwei
 */
export function requestUserConfirmation(
    ctx: AgentRunContext,
    detail: ConfirmationDetail
): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const confirmId = randomUUID()

        const timeout = setTimeout(() => {
            pendingConfirmations.delete(confirmId)
            reject(new Error('确认超时，操作已取消'))
        }, CONFIRMATION_TIMEOUT_MS)

        pendingConfirmations.set(confirmId, { resolve, reject, timeout })

        void ctx.emit({
            type: 'confirmation_request',
            confirmId,
            confirmDetail: detail,
            conversationId: ctx.conversationId
        })
    })
}

/**
 * 处理用户的确认/拒绝响应
 *
 * @param confirmId 确认请求 ID
 * @param approved 是否确认
 * @returns 是否找到了对应的待处理请求
 * @author xiangwei
 */
export function resolveUserConfirmation(confirmId: string, approved: boolean): boolean {
    const pending = pendingConfirmations.get(confirmId)
    if (!pending) return false

    clearTimeout(pending.timeout)
    pendingConfirmations.delete(confirmId)
    pending.resolve(approved)
    return true
}
