/**
 * IPC 处理器统一注册入口
 * @author xiangwei
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { ZodType } from 'zod'
import { createIpcSuccess } from '@shared/ipc/result'
import { getCurrentUserId } from '../services/session.service'
import { logger } from '../utils/logger'
import { createTraceId, runWithLogContext } from '../utils/logger'
import { summarizeLogValue } from '../utils/log-sanitizer'
import { getPublicErrorMessage } from './public-error'
import { isTrustedIpcSender } from './trusted-senders'

type Handler<TArgs extends unknown[], TResult> = (
    event: IpcMainInvokeEvent,
    ...args: TArgs
) => TResult | Promise<TResult>

type UserHandler<TArgs extends unknown[], TResult> = (
    userId: string,
    event: IpcMainInvokeEvent,
    ...args: TArgs
) => TResult | Promise<TResult>

/**
 * 注册标准 IPC 处理器
 *
 * @param channel IPC 频道
 * @param schema 参数校验规则
 * @param fallback 默认错误信息
 * @param handler 业务处理器
 * @author xiangwei
 */
export function registerIpcHandler<TArgs extends unknown[], TResult>(
    channel: string,
    schema: ZodType<TArgs>,
    fallback: string,
    handler: Handler<TArgs, TResult>
): void {
    ipcMain.handle(channel, (event, ...rawArgs: unknown[]) => {
        const startedAt = Date.now()
        const traceId = createTraceId('ipc')
        return runWithLogContext(
            {
                traceId,
                channel,
                operation: channel,
                webContentsId: event.sender.id
            },
            async () => {
                logger.info('IPC', `${channel} 开始`, {
                    arguments: rawArgs.map(summarizeLogValue)
                })
                try {
                    if (!isTrustedIpcSender(event)) {
                        throw new Error('拒绝非可信页面的 IPC 请求')
                    }
                    const args = schema.parse(rawArgs)
                    const data = await handler(event, ...args)
                    logger.info('IPC', `${channel} 完成`, { durationMs: Date.now() - startedAt })
                    return createIpcSuccess(data, traceId)
                } catch (error: unknown) {
                    const publicMessage = getPublicErrorMessage(error, fallback)
                    logger.error('IPC', `${channel} 失败`, {
                        durationMs: Date.now() - startedAt,
                        error
                    })
                    return {
                        ok: false,
                        error: `${publicMessage}（排查编号：${traceId}）`,
                        traceId
                    }
                }
            }
        )
    })
}

/**
 * 注册需要当前用户的 IPC 处理器
 *
 * @param channel IPC 频道
 * @param schema 参数校验规则
 * @param fallback 默认错误信息
 * @param handler 业务处理器
 * @author xiangwei
 */
export function registerUserIpcHandler<TArgs extends unknown[], TResult>(
    channel: string,
    schema: ZodType<TArgs>,
    fallback: string,
    handler: UserHandler<TArgs, TResult>
): void {
    registerIpcHandler(channel, schema, fallback, async (event, ...args) => {
        const userId = await getCurrentUserId()
        if (!userId) {
            throw new Error('请先选择用户')
        }
        return runWithLogContext({ userId }, () => handler(userId, event, ...args))
    })
}
