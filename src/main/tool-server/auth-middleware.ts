/**
 * 认证中间件
 *
 * 校验 HTTP 请求中的 Bearer Token。
 *
 * @author xiangwei
 */

import type { Request, Response, NextFunction } from 'express'
import { validateDeviceToken } from './pairing'

/**
 * Bearer Token 认证中间件
 *
 * /api/v1/pair 路由在注册时跳过认证，其余路由均使用此中间件。
 *
 * @author xiangwei
 */
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const authHeader = req.headers.authorization

    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: '缺少认证信息' }
        })
        return
    }

    const token = authHeader.slice(7)
    const isValid = await validateDeviceToken(token)

    if (!isValid) {
        res.status(401).json({
            success: false,
            error: { code: 'TOKEN_INVALID', message: '认证已失效，请重新配对' }
        })
        return
    }

    next()
}
