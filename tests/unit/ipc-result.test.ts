import { describe, expect, expectTypeOf, it } from 'vitest'
import { createIpcSuccess } from '../../src/shared/ipc/result'
import type { IpcResult } from '../../src/shared/types/api'

describe('IPC 成功响应', () => {
    it('无返回值时仍保留 data 字段', () => {
        const result = createIpcSuccess<void>(undefined)

        expect(result).toEqual({ ok: true, data: undefined })
        expect(Object.hasOwn(result, 'data')).toBe(true)
    })

    it('允许 undefined 的数据契约保持稳定', () => {
        const result = createIpcSuccess<string | undefined>(undefined)

        expectTypeOf(result).toEqualTypeOf<IpcResult<string | undefined>>()
        expect(result).toEqual({ ok: true, data: undefined })
    })

    it('成功响应可附带日志排查编号', () => {
        const result = createIpcSuccess('started', 'ipc-test-trace')

        expect(result).toEqual({ ok: true, data: 'started', traceId: 'ipc-test-trace' })
    })
})
