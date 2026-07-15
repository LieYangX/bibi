/**
 * 全局数据刷新总线
 * @author xiangwei
 */

export type RefreshEvent = 'transaction' | 'account' | 'category' | 'budget' | 'import'
type Listener = () => void | Promise<void>

const listeners: Record<RefreshEvent, Set<Listener>> = {
    transaction: new Set(),
    account: new Set(),
    category: new Set(),
    budget: new Set(),
    import: new Set()
}
const scheduledListeners = new Set<Listener>()

/**
 * 在同一微任务内合并相同监听器的多次刷新
 *
 * @param listener 刷新监听器
 * @author xiangwei
 */
function scheduleListener(listener: Listener): void {
    if (scheduledListeners.has(listener)) return
    scheduledListeners.add(listener)
    queueMicrotask(() => {
        scheduledListeners.delete(listener)
        try {
            void Promise.resolve(listener()).catch((error: unknown) => {
                console.error('[刷新总线] 异步监听器执行失败', error)
            })
        } catch (error: unknown) {
            console.error('[刷新总线] 监听器执行失败', error)
        }
    })
}

/** 触发某类数据的刷新通知 */
export function emitRefresh(event: RefreshEvent): void {
    listeners[event]?.forEach(scheduleListener)
}

/** 订阅刷新事件，返回取消订阅函数 */
export function onRefresh(event: RefreshEvent, listener: Listener): () => void {
    listeners[event]?.add(listener)
    return () => {
        listeners[event]?.delete(listener)
    }
}

/** 订阅多个数据类别的刷新事件 */
export function onRefreshMany(events: RefreshEvent[], listener: Listener): () => void {
    const offs = events.map((e) => onRefresh(e, listener))
    return () => offs.forEach((off) => off())
}
