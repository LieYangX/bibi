/**
 * 用户列表路由
 *
 * @author xiangwei
 */

import type { Express } from 'express'
import { listUsers } from '../../services/user.service'

/**
 * 注册用户列表路由
 *
 * @param app Express 应用实例
 * @author xiangwei
 */
export function registerUsersRoutes(app: Express): void {
    app.get('/api/v1/users', async (_req, res) => {
        try {
            const users = await listUsers()

            res.json({ success: true, data: users })
        } catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'USER_LIST_ERROR',
                    message: '获取用户列表失败'
                }
            })
        }
    })
}
