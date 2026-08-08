/**
 * 工具路由
 *
 * @author xiangwei
 */

import type { Express } from 'express'
import { exportToolInfos, executeTool } from '../tool-router'

/**
 * 注册工具路由
 *
 * @param app Express 应用实例
 * @author xiangwei
 */
export function registerToolsRoutes(app: Express): void {
    // 获取工具列表
    app.get('/api/v1/tools', (_req, res) => {
        try {
            const tools = exportToolInfos()

            res.json({ success: true, data: tools })
        } catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'TOOL_LIST_ERROR',
                    message: error instanceof Error ? error.message : '获取工具列表失败'
                }
            })
        }
    })

    // 执行指定工具
    app.post('/api/v1/tools/:toolName', async (req, res) => {
        try {
            const { toolName } = req.params
            const args = req.body as Record<string, unknown>

            const result = await executeTool(toolName, args)

            res.json({ success: true, data: result })
        } catch (error) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'TOOL_EXECUTION_ERROR',
                    message: error instanceof Error ? error.message : '工具执行失败'
                }
            })
        }
    })
}
