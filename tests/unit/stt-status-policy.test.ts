import { describe, expect, it } from 'vitest'
import { shouldPrepareCachedModel } from '../../src/main/services/stt-status-policy'

describe('STT 状态查询策略', () => {
    it('设置页指定模型时不触发缓存模型初始化', () => {
        expect(
            shouldPrepareCachedModel('Xenova/whisper-base', 'none', 'Xenova/whisper-base', true)
        ).toBe(false)
    })

    it('实际使用入口允许按需准备缓存模型', () => {
        expect(shouldPrepareCachedModel(undefined, 'none', 'Xenova/whisper-base', true)).toBe(true)
    })

    it('模型未缓存或运行时已有状态时不重复准备', () => {
        expect(shouldPrepareCachedModel(undefined, 'none', 'Xenova/whisper-base', false)).toBe(
            false
        )
        expect(shouldPrepareCachedModel(undefined, 'loading', 'Xenova/whisper-base', true)).toBe(
            false
        )
        expect(shouldPrepareCachedModel(undefined, 'ready', 'Xenova/whisper-base', true)).toBe(
            false
        )
    })
})
