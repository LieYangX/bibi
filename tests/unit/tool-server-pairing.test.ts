import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    generatePairingCode,
    listPairedDevices,
    PAIRING_CODE_TTL_MS,
    revokeDevice,
    validateDeviceToken,
    verifyPairingCode
} from '../../src/main/tool-server/pairing'
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

describe('工具服务配对管理', () => {
    beforeEach(() => {
        memoryStore.clear()
        vi.clearAllMocks()
    })

    it('generatePairingCode 返回 6 位数字并覆盖上一次生成的配对码', async () => {
        const firstCode = await generatePairingCode()

        expect(firstCode).toMatch(/^\d{6}$/)

        const secondCode = await generatePairingCode()

        expect(secondCode).toMatch(/^\d{6}$/)
        expect(secondCode).not.toBe(firstCode)
    })

    it('verifyPairingCode 对有效配对码返回设备令牌并将配对码标记为已使用', async () => {
        const code = await generatePairingCode()

        const token = await verifyPairingCode(code)

        expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

        const devices = await listPairedDevices()

        expect(devices).toHaveLength(1)
        expect(devices[0].token).toBe(token)
    })

    it('verifyPairingCode 对过期配对码抛出异常', async () => {
        const code = await generatePairingCode()

        // 伪造时间，使配对码立即过期
        const now = Date.now()
        vi.spyOn(Date, 'now').mockReturnValue(now + PAIRING_CODE_TTL_MS + 1000)

        await expect(verifyPairingCode(code)).rejects.toThrow('配对码已过期')

        vi.restoreAllMocks()
    })

    it('verifyPairingCode 对已使用的配对码抛出异常', async () => {
        const code = await generatePairingCode()

        await verifyPairingCode(code)

        await expect(verifyPairingCode(code)).rejects.toThrow('配对码无效或已使用')
    })

    it('verifyPairingCode 对错误配对码抛出异常', async () => {
        await generatePairingCode()

        await expect(verifyPairingCode('000000')).rejects.toThrow('配对码无效或已使用')
    })

    it('validateDeviceToken 对有效令牌返回 true 并更新最后活跃时间', async () => {
        const code = await generatePairingCode()
        const token = await verifyPairingCode(code)
        const beforeValidate = Date.now()

        // 清除 setSetting 调用记录，以便仅观察 validate 导致的写入
        vi.mocked(settingService.setSetting).mockClear()

        const isValid = await validateDeviceToken(token)

        expect(isValid).toBe(true)
        expect(settingService.setSetting).toHaveBeenCalled()

        const devices = await listPairedDevices()
        const device = devices.find((item) => item.token === token)

        expect(device).toBeDefined()
        expect(Date.parse(device!.lastSeenAt)).toBeGreaterThanOrEqual(beforeValidate)
    })

    it('validateDeviceToken 对无效令牌返回 false', async () => {
        const isValid = await validateDeviceToken('invalid-token')

        expect(isValid).toBe(false)
    })

    it('listPairedDevices 返回已持久化的设备列表', async () => {
        const persistedDevices = [
            {
                token: 'token-a',
                name: '设备 A',
                createdAt: Date.now() - 1000,
                lastSeenAt: Date.now() - 500
            },
            {
                token: 'token-b',
                name: '设备 B',
                createdAt: Date.now() - 2000,
                lastSeenAt: Date.now() - 1000
            }
        ]

        await settingService.setSetting('paired_devices', persistedDevices)

        const devices = await listPairedDevices()

        expect(devices).toEqual(persistedDevices)
    })

    it('revokeDevice 移除指定令牌对应的设备', async () => {
        const code = await generatePairingCode()
        const token = await verifyPairingCode(code)

        await revokeDevice(token)

        const devices = await listPairedDevices()

        expect(devices).toHaveLength(0)
        expect(await validateDeviceToken(token)).toBe(false)
    })
})
