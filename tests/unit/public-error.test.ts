import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { getPublicErrorMessage } from '../../src/main/ipc/public-error'

const FALLBACK_MESSAGE = '操作失败'

describe('IPC 公开错误映射', () => {
    it('保留业务错误信息', () => {
        expect(getPublicErrorMessage(new Error('用户不存在'), FALLBACK_MESSAGE)).toBe('用户不存在')
    })

    it('屏蔽带系统错误码的路径信息', () => {
        const error = Object.assign(
            new Error("ENOENT: no such file, open 'C:\\secret\\data.csv'"),
            {
                code: 'ENOENT',
                path: 'C:\\secret\\data.csv',
                syscall: 'open'
            }
        )

        expect(getPublicErrorMessage(error, FALLBACK_MESSAGE)).toBe(FALLBACK_MESSAGE)
    })

    it('屏蔽数据库内部错误', () => {
        const error = Object.assign(new Error('数据库文件已损坏'), { name: 'SqliteError' })

        expect(getPublicErrorMessage(error, FALLBACK_MESSAGE)).toBe(FALLBACK_MESSAGE)
    })

    it('保留参数校验的安全提示', () => {
        const result = z.string().min(2, '至少输入两个字符').safeParse('a')
        if (result.success) throw new Error('测试数据应触发校验失败')

        expect(getPublicErrorMessage(result.error, FALLBACK_MESSAGE)).toBe(
            '请求参数无效: 至少输入两个字符'
        )
    })
})
