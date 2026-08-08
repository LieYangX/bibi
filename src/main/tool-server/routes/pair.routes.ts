/**
 * 配对路由
 *
 * @author xiangwei
 */

import type { Express } from 'express'
import { verifyPairingCode } from '../pairing'

/**
 * 配对请求体
 */
interface PairRequest {
    code: string
    deviceName: string
}

/**
 * 注册配对路由
 *
 * @param app Express 应用实例
 * @author xiangwei
 */
export function registerPairRoutes(app: Express): void {
    app.post('/api/v1/pair', async (req, res) => {
        try {
            const { code, deviceName } = req.body as PairRequest

            if (!code || !deviceName) {
                res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_PARAMS', message: '缺少 code 或 deviceName' }
                })
                return
            }

            const token = await verifyPairingCode(code, deviceName)

            res.json({
                success: true,
                data: { token, deviceName }
            })
        } catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'PAIRING_FAILED',
                    message: error instanceof Error ? error.message : '配对失败'
                }
            })
        }
    })
}
