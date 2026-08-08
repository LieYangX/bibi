/**
 * 健康检查路由
 *
 * @author xiangwei
 */

import type { Express } from 'express'
import { getPersistedCurrentUserId } from '../../services/session.service'

/**
 * 注册健康检查路由
 *
 * @param app Express 应用实例
 * @author xiangwei
 */
export function registerPingRoutes(app: Express): void {
    app.get('/api/v1/ping', async (_req, res) => {
        const userId = await getPersistedCurrentUserId()

        res.json({
            success: true,
            data: {
                status: 'ok',
                currentUser: userId,
                timestamp: Date.now()
            }
        })
    })
}
