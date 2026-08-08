import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { authMiddleware } from '../../src/main/tool-server/auth-middleware'
import * as settingService from '../../src/main/services/setting.service'

const memoryStore = new Map<string, unknown>()

vi.mock('../../src/main/services/setting.service', () => ({
    getSetting: vi.fn(async <T>(key: string, defaultValue?: T): Promise<T | undefined> => {
        if (memoryStore.has(key)) {
            return memoryStore.get(key) as T
        }
        return defaultValue
    }),
    setSetting: vi.fn(async (key: string, value: unknown): Promise<void> => {
        memoryStore.set(key, value)
    })
}))

describe('工具服务认证中间件', () => {
    beforeEach(() => {
        memoryStore.clear()
        vi.clearAllMocks()
    })

    function createMockRequest(authHeader?: string): Request {
        return {
            headers: { authorization: authHeader }
        } as unknown as Request
    }

    function createMockResponse(): Response {
        const res = {
            statusCode: 200,
            jsonBody: undefined,
            status(code: number) {
                this.statusCode = code
                return this
            },
            json(body: unknown) {
                this.jsonBody = body
                return this
            }
        } as unknown as Response
        return res
    }

    it('缺少 Authorization header 返回 401', async () => {
        const req = createMockRequest()
        const res = createMockResponse()
        const next = vi.fn() as NextFunction

        await authMiddleware(req, res, next)

        expect(res.statusCode).toBe(401)
        expect(next).not.toHaveBeenCalled()
    })

    it('非 Bearer 格式返回 401', async () => {
        const req = createMockRequest('Basic xxx')
        const res = createMockResponse()
        const next = vi.fn() as NextFunction

        await authMiddleware(req, res, next)

        expect(res.statusCode).toBe(401)
    })

    it('无效 token 返回 401', async () => {
        const req = createMockRequest('Bearer invalid-token')
        const res = createMockResponse()
        const next = vi.fn() as NextFunction

        await authMiddleware(req, res, next)

        expect(res.statusCode).toBe(401)
    })

    it('有效 token 调用 next()', async () => {
        const token = 'valid-token'
        await settingService.setSetting('paired_devices', [
            { token, deviceName: 'test', pairedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() }
        ])

        const req = createMockRequest(`Bearer ${token}`)
        const res = createMockResponse()
        const next = vi.fn() as NextFunction

        await authMiddleware(req, res, next)

        expect(next).toHaveBeenCalled()
        expect(res.statusCode).toBe(200)
    })
})
