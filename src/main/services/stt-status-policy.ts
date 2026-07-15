/** STT 运行时状态 */
export type SttRuntimeStatus = 'none' | 'loading' | 'ready' | 'error'

/**
 * 判断状态查询是否应按需准备缓存模型
 *
 * 只有实际使用入口未指定模型时才允许准备模型；设置页会指定模型 ID，
 * 其状态查询必须保持无副作用。
 *
 * @param requestedModelId 调用方指定的模型 ID
 * @param status 当前运行时状态
 * @param targetModelId 待检查的模型 ID
 * @param cached 模型是否已缓存
 * @returns 是否应准备缓存模型
 * @author xiangwei
 */
export function shouldPrepareCachedModel(
    requestedModelId: string | undefined,
    status: SttRuntimeStatus,
    targetModelId: string | undefined,
    cached: boolean
): boolean {
    return requestedModelId === undefined && status === 'none' && Boolean(targetModelId) && cached
}
