/**
 * Tool Server 入口
 *
 *  orchestrate HTTP server + Bonjour broadcast lifecycle.
 *
 * @author xiangwei
 */

import { startHttpServer, stopHttpServer } from './http-server'
import { startBonjourBroadcast, stopBonjourBroadcast } from './bonjour'
import { logger } from '../utils/logger'

/** 是否已启动 */
let started = false

/**
 * 启动 Tool Server（HTTP + Bonjour）
 *
 * @author xiangwei
 */
export async function startToolServer(): Promise<void> {
    if (started) {
        logger.warn('ToolServer', 'Tool Server 已在运行，跳过启动')
        return
    }

    try {
        await startHttpServer()
        await startBonjourBroadcast()
        started = true

        logger.info('ToolServer', 'Tool Server 启动完成')
    } catch (error) {
        logger.error('ToolServer', 'Tool Server 启动失败', { error })
        throw error
    }
}

/**
 * 停止 Tool Server
 *
 * @author xiangwei
 */
export async function stopToolServer(): Promise<void> {
    if (!started) {
        return
    }

    await stopHttpServer()
    stopBonjourBroadcast()
    started = false

    logger.info('ToolServer', 'Tool Server 已停止')
}
