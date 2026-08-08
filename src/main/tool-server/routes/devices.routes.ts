/**
 * 设备管理路由
 *
 * @author xiangwei
 */

import type { Express } from 'express'
import { listPairedDevices, revokeDevice } from '../pairing'

/**
 * 注册设备管理路由
 *
 * @param app Express 应用实例
 * @author xiangwei
 */
export function registerDevicesRoutes(app: Express): void {
    // 已配对设备列表
    app.get('/api/v1/devices', async (_req, res) => {
        const devices = await listPairedDevices()

        res.json({ success: true, data: devices })
    })

    // 撤销设备
    app.delete('/api/v1/devices/:token', async (req, res) => {
        const { token } = req.params

        await revokeDevice(token)

        res.json({ success: true, data: null })
    })
}
