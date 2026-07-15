/**
 * 窗口最大化状态订阅工具
 * @author xiangwei
 */

export interface MaximizeStateSource {
    getCurrent: () => Promise<boolean | undefined>
    subscribe: (listener: (maximized: boolean) => void) => () => void
}

/**
 * 同步初始最大化状态并持续监听变化
 *
 * @param source 最大化状态来源
 * @param onChange 状态更新回调
 * @returns 取消订阅函数
 * @author xiangwei
 */
export function observeMaximizeState(
    source: MaximizeStateSource,
    onChange: (maximized: boolean) => void
): () => void {
    let active = true
    let receivedChange = false

    const stop = source.subscribe((maximized) => {
        if (!active) return
        receivedChange = true
        onChange(maximized)
    })

    void source
        .getCurrent()
        .then((maximized) => {
            if (!active || receivedChange || maximized === undefined) return
            onChange(maximized)
        })
        .catch(() => undefined)

    return () => {
        if (!active) return
        active = false
        stop()
    }
}
