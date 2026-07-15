import { describe, expect, it, vi } from 'vitest'
import { observeMaximizeState } from '../../src/renderer/src/components/window-maximize-state'

interface Deferred<T> {
    promise: Promise<T>
    resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
    let resolve: (value: T) => void = () => undefined
    const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve
    })
    return { promise, resolve }
}

describe('窗口最大化状态订阅', () => {
    it('同步初始状态并释放监听器', async () => {
        const onChange = vi.fn()
        const stopListener = vi.fn()
        const stop = observeMaximizeState(
            {
                getCurrent: async () => false,
                subscribe: () => stopListener
            },
            onChange
        )

        await Promise.resolve()
        expect(onChange).toHaveBeenCalledWith(false)

        stop()
        expect(stopListener).toHaveBeenCalledOnce()
    })

    it('变化事件先到达时忽略过期的初始查询', async () => {
        const initialState = createDeferred<boolean | undefined>()
        const onChange = vi.fn()
        let listener: (maximized: boolean) => void = () => undefined

        observeMaximizeState(
            {
                getCurrent: () => initialState.promise,
                subscribe: (nextListener) => {
                    listener = nextListener
                    return () => undefined
                }
            },
            onChange
        )

        listener(true)
        initialState.resolve(false)
        await initialState.promise

        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith(true)
    })

    it('组件释放后不再处理异步结果或事件', async () => {
        const initialState = createDeferred<boolean | undefined>()
        const onChange = vi.fn()
        const stopListener = vi.fn()
        let listener: (maximized: boolean) => void = () => undefined
        const stop = observeMaximizeState(
            {
                getCurrent: () => initialState.promise,
                subscribe: (nextListener) => {
                    listener = nextListener
                    return stopListener
                }
            },
            onChange
        )

        stop()
        stop()
        listener(true)
        initialState.resolve(false)
        await initialState.promise

        expect(stopListener).toHaveBeenCalledOnce()
        expect(onChange).not.toHaveBeenCalled()
    })
})
