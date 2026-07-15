import { describe, expect, it, vi } from 'vitest'
import { emitRefresh, onRefreshMany } from '../../src/renderer/src/composables/useRefreshBus'

describe('刷新总线', () => {
    it('在同一微任务内合并相同监听器', async () => {
        const listener = vi.fn()
        const stop = onRefreshMany(['transaction', 'budget'], listener)

        emitRefresh('transaction')
        emitRefresh('budget')
        await Promise.resolve()

        expect(listener).toHaveBeenCalledTimes(1)
        stop()
    })
})
