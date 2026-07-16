import { describe, expect, it } from 'vitest'
import { shouldRefreshWechatQrCode } from '../../src/main/agent/wechat-channel.policy'

describe('微信二维码状态策略', () => {
    it('仅在二维码过期时重新获取', () => {
        expect(shouldRefreshWechatQrCode('wait')).toBe(false)
        expect(shouldRefreshWechatQrCode('scaned')).toBe(false)
        expect(shouldRefreshWechatQrCode('confirmed')).toBe(false)
        expect(shouldRefreshWechatQrCode('expired')).toBe(true)
    })
})
