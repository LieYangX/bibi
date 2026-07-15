/**
 * STT（语音转文字）IPC 处理器
 * @author xiangwei
 */

import { IPC_CHANNELS } from '@shared/ipc/channels'
import { IPC_SCHEMAS } from '@shared/ipc/schemas'
import { registerIpcHandler } from './handle-ipc'
import { logger } from '../utils/logger'
import {
    transcribeAudio,
    isModelLoading,
    downloadModel,
    getModelStatus,
    isModelCached,
    deleteModelFiles,
    STT_MODELS
} from '../services/stt.service'
import type { SttProgressCallback } from '../services/stt.service'
import { getSetting } from '../services/setting.service'
import { shouldPrepareCachedModel } from '../services/stt-status-policy'

// 设置键名
const SETTING_STT_ENABLED = 'stt_enabled'
const SETTING_STT_MODEL = 'stt_model'

/**
 * 尝试自动从缓存恢复模型
 * 如果模型未加载但磁盘缓存完整，则在后台触发加载
 *
 * @param modelId 模型 ID
 * @param onProgress 进度回调
 * @author xiangwei
 */
async function tryAutoLoadModel(modelId: string, onProgress: SttProgressCallback): Promise<void> {
    if (!isModelCached(modelId)) return

    logger.info('STT', `缓存存在，自动加载模型: ${modelId}`)
    onProgress({ status: 'initiate', progress: 0, file: modelId })
    try {
        await downloadModel(modelId, onProgress)
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('STT', `自动加载模型失败: ${msg}`)
        onProgress({ status: 'error', error: `自动加载模型失败: ${msg}` })
    }
}

/**
 * 注册 STT IPC 处理器
 * @author xiangwei
 */
export function registerSttIpc(): void {
    // 语音转文字——接收音频 ArrayBuffer，返回转录文本
    registerIpcHandler(
        IPC_CHANNELS.agent.transcribeAudio,
        IPC_SCHEMAS.agent.transcribeAudio,
        '语音识别失败',
        async (event, audioBuffer: ArrayBuffer) => {
            const onProgress: SttProgressCallback = (progress) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send(IPC_CHANNELS.agent.transcribeProgress, progress)
                }
            }

            if (isModelLoading()) {
                onProgress({ status: 'initiate', progress: 0 })
            }

            const floatArray = new Float32Array(audioBuffer)
            const text = await transcribeAudio(floatArray, onProgress)
            return text
        }
    )

    // 下载 STT 模型——触发模型下载，进度通过 transcribeProgress 事件推送
    registerIpcHandler(
        IPC_CHANNELS.agent.sttDownloadModel,
        IPC_SCHEMAS.agent.sttDownloadModel,
        '模型下载失败',
        async (event, modelId: string) => {
            const onProgress: SttProgressCallback = (progress) => {
                if (!event.sender.isDestroyed()) {
                    event.sender.send(IPC_CHANNELS.agent.transcribeProgress, progress)
                }
            }

            await downloadModel(modelId, onProgress)
        }
    )

    // 查询 STT 模型状态
    registerIpcHandler(
        IPC_CHANNELS.agent.sttModelStatus,
        IPC_SCHEMAS.agent.sttModelStatus,
        '查询模型状态失败',
        async (event, modelId?: string) => {
            const status = getModelStatus(modelId)

            // 确定要检查的模型 ID：没传则从设置读取
            let targetModelId = modelId
            if (status.status === 'none' && !targetModelId) {
                const enabled = await getSetting<boolean>(SETTING_STT_ENABLED, false)
                if (enabled) {
                    targetModelId = await getSetting<string>(
                        SETTING_STT_MODEL,
                        'Xenova/whisper-base'
                    )
                }
            }

            const cached = targetModelId ? isModelCached(targetModelId) : false

            // 未指定模型表示实际使用入口，可按需恢复；设置页的指定模型查询保持无副作用。
            if (
                shouldPrepareCachedModel(modelId, status.status, targetModelId, cached) &&
                targetModelId
            ) {
                const onProgress: SttProgressCallback = (progress) => {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send(IPC_CHANNELS.agent.transcribeProgress, progress)
                    }
                }
                // 模型初始化在 Worker 中执行，此处立即返回加载状态。
                void tryAutoLoadModel(targetModelId, onProgress)
                return {
                    status: 'loading' as const,
                    currentModel: targetModelId,
                    error: null,
                    cached,
                    models: STT_MODELS.map((m) => ({
                        id: m.id,
                        name: m.name,
                        size: m.size,
                        desc: m.desc
                    }))
                }
            }

            return {
                ...status,
                cached,
                models: STT_MODELS.map((m) => ({
                    id: m.id,
                    name: m.name,
                    size: m.size,
                    desc: m.desc
                }))
            }
        }
    )

    // 删除已下载的 STT 模型缓存
    registerIpcHandler(
        IPC_CHANNELS.agent.sttDeleteModel,
        IPC_SCHEMAS.agent.sttDeleteModel,
        '删除模型失败',
        async (_event, modelId: string) => {
            return deleteModelFiles(modelId)
        }
    )
}
