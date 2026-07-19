/**
 * Agent 运行时上下文
 * 通过 AsyncLocalStorage 在工具执行链中传递 userId / conversationId / emit
 * 现有工具无需改动，仅 task-planning 等需要会话上下文的工具通过 getCurrentAgentContext 获取
 * @author xiangwei
 */

import { AsyncLocalStorage } from 'async_hooks'
import type { StreamEvent } from '@shared/types'

/** 流式事件发射器 */
export type EventEmitter = (event: StreamEvent) => Promise<void>

/** Agent 执行上下文 */
export interface AgentRunContext {
    userId: string
    conversationId: string
    emit: EventEmitter
}

const agentContextStorage = new AsyncLocalStorage<AgentRunContext>()

/**
 * 在绑定 Agent 上下文的异步作用域中执行任务
 *
 * @param context Agent 运行时上下文
 * @param operation 任务函数
 * @returns 任务返回值
 * @author xiangwei
 */
export function runWithAgentContext<TResult>(
    context: AgentRunContext,
    operation: () => TResult
): TResult {
    return agentContextStorage.run(context, operation)
}

/**
 * 获取当前异步作用域中的 Agent 上下文
 *
 * @returns Agent 上下文，未在作用域内时返回 undefined
 * @author xiangwei
 */
export function getCurrentAgentContext(): AgentRunContext | undefined {
    return agentContextStorage.getStore()
}
