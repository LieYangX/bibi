/**
 * 配对认证服务
 *
 * 负责生成配对码、验证配对码并签发 device token、校验 token、
 * 管理已配对设备列表。
 *
 * @author xiangwei
 */

import { randomUUID } from 'crypto'
import { getSetting, setSetting } from '../services/setting.service'
import { logger } from '../utils/logger'

/** 配对码有效期：5 分钟 */
export const PAIRING_CODE_TTL_MS = 5 * 60 * 1000

/** settings 表中存储已配对设备的 key */
const SETTING_KEY = 'paired_devices'

/** 已配对设备信息 */
export interface PairedDevice {
    token: string
    deviceName: string
    pairedAt: string
    lastSeenAt: string
}

/** 当前有效配对码条目 */
interface PairingCodeEntry {
    code: string
    expiresAt: number
    used: boolean
}

/** 当前有效配对码（内存中，不持久化） */
let currentPairingCode: PairingCodeEntry | null = null

/**
 * 生成 6 位数字配对码
 *
 * 同一时刻只有一个有效配对码，重复生成会覆盖旧的。
 *
 * @returns 6 位数字配对码
 * @author xiangwei
 */
export async function generatePairingCode(): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000))

    currentPairingCode = {
        code,
        expiresAt: Date.now() + PAIRING_CODE_TTL_MS,
        used: false
    }

    logger.info('ToolServer', '配对码已生成', { expiresIn: PAIRING_CODE_TTL_MS })

    return code
}

/**
 * 验证配对码并签发 device token
 *
 * 配对码验证通过后立即标记为已使用，不可重复使用。
 *
 * @param code 用户输入的配对码
 * @param deviceName iOS 设备名
 * @returns device token
 * @author xiangwei
 */
export async function verifyPairingCode(
    code: string,
    deviceName = '未知设备'
): Promise<string> {
    if (!currentPairingCode) {
        throw new Error('未生成配对码，请先在 PC 端发起配对')
    }

    if (Date.now() > currentPairingCode.expiresAt) {
        throw new Error('配对码已过期')
    }

    if (currentPairingCode.used || currentPairingCode.code !== code) {
        throw new Error('配对码无效或已使用')
    }

    // 标记已使用
    currentPairingCode.used = true

    // 签发 token
    const token = randomUUID()
    const device: PairedDevice = {
        token,
        deviceName,
        pairedAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
    }

    // 持久化到 settings 表
    const existing = (await getSetting<PairedDevice[]>(SETTING_KEY)) ?? []
    existing.push(device)
    await setSetting(SETTING_KEY, existing)

    logger.info('ToolServer', '设备配对成功', {
        deviceName,
        token: token.slice(0, 8) + '...'
    })

    return token
}

/**
 * 校验 device token 是否有效
 *
 * 校验成功后会更新该设备的最后活跃时间。
 *
 * @param token 设备 token
 * @returns 是否有效
 * @author xiangwei
 */
export async function validateDeviceToken(token: string): Promise<boolean> {
    const devices = (await getSetting<PairedDevice[]>(SETTING_KEY)) ?? []
    const device = devices.find((item) => item.token === token)

    if (!device) {
        return false
    }

    // 更新最后活跃时间
    device.lastSeenAt = new Date().toISOString()
    await setSetting(SETTING_KEY, devices)

    return true
}

/**
 * 获取已配对设备列表
 *
 * @returns 已配对设备列表
 * @author xiangwei
 */
export async function listPairedDevices(): Promise<PairedDevice[]> {
    return (await getSetting<PairedDevice[]>(SETTING_KEY)) ?? []
}

/**
 * 撤销设备配对
 *
 * @param token 设备 token
 * @author xiangwei
 */
export async function revokeDevice(token: string): Promise<void> {
    const devices = (await getSetting<PairedDevice[]>(SETTING_KEY)) ?? []
    const filtered = devices.filter((item) => item.token !== token)

    await setSetting(SETTING_KEY, filtered)

    logger.info('ToolServer', '设备已撤销', {
        token: token.slice(0, 8) + '...'
    })
}
