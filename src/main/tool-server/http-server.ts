/**
 * HTTP Tool Server
 *
 * 在 Electron 主进程内启动 Express HTTP 服务，暴露工具 REST API。
 *
 * @author xiangwei
 */

import express, { type Request, type Response, type NextFunction } from 'express'
import type { Server } from 'http'
import { authMiddleware } from './auth-middleware'
import { registerPairRoutes } from './routes/pair.routes'
import { registerPingRoutes } from './routes/ping.routes'
import { registerUsersRoutes } from './routes/users.routes'
import { registerToolsRoutes } from './routes/tools.routes'
import { registerDevicesRoutes } from './routes/devices.routes'
import { logger } from '../utils/logger'

/** HTTP API 端口 */
const HTTP_PORT = 19878

/** Express 服务实例 */
let server: Server | null = null

/**
 * 启动 HTTP Tool Server
 *
 * @author xiangwei
 */
export function startHttpServer(): Promise<void> {
    return new Promise((resolve) => {
        const app = express()

        // JSON body 解析（限制 1MB 防止大请求体攻击）
        app.use(express.json({ limit: '1mb' }))

        // CORS：允许所有来源（局域网内 iOS 设备访问）
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*')
            res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

            if (req.method === 'OPTIONS') {
                res.sendStatus(204)
                return
            }

            next()
        })

        // 请求日志
        app.use((req, _res, next) => {
            logger.info('ToolServer', `${req.method} ${req.path}`, {
                ip: req.ip
            })
            next()
        })

        // /api/v1/pair 不需要认证
        registerPairRoutes(app)

        // 其余路由需要认证
        app.use('/api/v1', authMiddleware)
        registerPingRoutes(app)
        registerUsersRoutes(app)
        registerToolsRoutes(app)
        registerDevicesRoutes(app)

        // 统一错误处理
        app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
            logger.error('ToolServer', '请求处理异常', { error: err.message })
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
            })
        })

        server = app.listen(HTTP_PORT, () => {
            logger.info('ToolServer', 'HTTP Tool Server 已启动', { port: HTTP_PORT })
            resolve()
        })
    })
}

/**
 * 停止 HTTP Tool Server
 *
 * @author xiangwei
 */
export function stopHttpServer(): Promise<void> {
    return new Promise((resolve) => {
        if (!server) {
            resolve()
            return
        }

        server.close(() => {
            server = null
            logger.info('ToolServer', 'HTTP Tool Server 已停止')
            resolve()
        })
    })
}
