/**
 * 本地语音转文字服务（STT）
 *
 * 使用 @huggingface/transformers 加载 whisper 模型，
 * 在本地完成语音识别，无需联网。
 *
 * @author xiangwei
 */

import { app } from 'electron'
import { isAbsolute, join, relative, resolve } from 'path'
import { existsSync, rmSync, readdirSync } from 'fs'
import { Worker } from 'node:worker_threads'
import {
    STT_MODEL_IDS,
    STT_MODELS as SHARED_STT_MODELS,
    type SttModelId,
    type SttProgressEvent
} from '@shared/types'
import type { SttWorkerRequest, SttWorkerResponse } from '../workers/stt-worker.types'
import { logger } from '../utils/logger'

const DEFAULT_STT_MODEL_ID: SttModelId = 'Xenova/whisper-base'
const STT_REMOTE_HOST = 'https://hf-mirror.com/'

/**
 * 获取 STT 模型缓存目录路径
 *
 * 开发环境放在项目根目录，方便查看和管理；
 * 打包后使用用户数据目录，遵循标准桌面应用规范。
 *
 * @returns STT 模型缓存目录绝对路径
 * @author xiangwei
 */
function getSttCacheDir(): string {
    if (app.isPackaged) {
        return join(app.getPath('userData'), 'stt-cache')
    }
    return join(app.getAppPath(), 'stt-cache')
}

/** 可用模型列表 */
export const STT_MODELS = SHARED_STT_MODELS

/**
 * 断言模型 ID 位于内置白名单
 *
 * @param modelId 模型 ID
 * @author xiangwei
 */
function assertSupportedModelId(modelId: string): asserts modelId is SttModelId {
    if (!(STT_MODEL_IDS as readonly string[]).includes(modelId)) {
        throw new Error('不支持的语音模型')
    }
}

/**
 * 获取模型缓存目录并保证路径位于 STT 缓存根目录内
 *
 * @param modelId 模型 ID
 * @returns 模型缓存目录绝对路径
 * @author xiangwei
 */
function getModelCacheDir(modelId: string): string {
    assertSupportedModelId(modelId)
    const cacheRoot = resolve(getSttCacheDir())
    const modelDir = resolve(cacheRoot, ...modelId.split('/'))
    const relativePath = relative(cacheRoot, modelDir)
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
        throw new Error('语音模型缓存路径无效')
    }
    return modelDir
}

/** 模型下载进度回调 */
export type SttProgressCallback = (progress: {
    status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'error'
    /** 当前文件名称 */
    file?: string
    /** 下载进度百分比（0-100） */
    progress?: number
    /** 已下载字节数 */
    loaded?: number
    /** 总字节数 */
    total?: number
    /** 错误信息 */
    error?: string
}) => void

type SttWorkerRequestPayload =
    | Omit<Extract<SttWorkerRequest, { type: 'load' }>, 'id'>
    | Omit<Extract<SttWorkerRequest, { type: 'transcribe' }>, 'id'>

interface PendingWorkerRequest {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    onProgress?: SttProgressCallback
}

let sttWorker: Worker | null = null
let workerRequestId = 0
const pendingWorkerRequests = new Map<number, PendingWorkerRequest>()

/** 初始化状态 */
let initializing = false
let initialized = false
let initializationPromise: Promise<void> | null = null
let runtimeGeneration = 0

/** 当前模型 ID */
let currentModelId: string | null = null

/** 初始化错误 */
let initError: string | null = null

/**
 * 拒绝当前 Worker 上尚未完成的请求
 *
 * @param error 失败原因
 * @author xiangwei
 */
function rejectPendingWorkerRequests(error: Error): void {
    for (const request of pendingWorkerRequests.values()) {
        request.reject(error)
    }
    pendingWorkerRequests.clear()
}

/**
 * 处理 Worker 异常退出
 *
 * @param targetWorker 发生异常的 Worker
 * @param error 异常信息
 * @author xiangwei
 */
function handleWorkerFailure(targetWorker: Worker, error: Error): void {
    if (sttWorker !== targetWorker) return

    sttWorker = null
    runtimeGeneration += 1
    initializing = false
    initialized = false
    initializationPromise = null
    currentModelId = null
    initError = error.message
    rejectPendingWorkerRequests(error)
    logger.error('STT', `模型工作线程异常: ${error.message}`)
}

/**
 * 获取或创建 STT 工作线程
 *
 * @returns STT 工作线程
 * @author xiangwei
 */
function getSttWorker(): Worker {
    if (sttWorker) return sttWorker

    const worker = new Worker(join(__dirname, 'workers', 'stt.worker.js'), {
        workerData: {
            cacheDir: getSttCacheDir(),
            remoteHost: STT_REMOTE_HOST
        }
    })

    worker.on('message', (message: SttWorkerResponse) => {
        const pending = pendingWorkerRequests.get(message.id)
        if (!pending) return

        if (message.type === 'progress') {
            pending.onProgress?.(message.progress)
            return
        }

        pendingWorkerRequests.delete(message.id)
        if (message.type === 'error') {
            pending.reject(new Error(message.error))
            return
        }
        pending.resolve(message.result)
    })
    worker.on('error', (error) => handleWorkerFailure(worker, error))
    worker.on('exit', (code) => {
        if (sttWorker === worker) {
            handleWorkerFailure(worker, new Error(`模型工作线程意外退出，退出码 ${code}`))
        }
    })
    sttWorker = worker
    return worker
}

/**
 * 向 STT 工作线程发送请求
 *
 * @param payload 请求内容
 * @param onProgress 进度回调
 * @param transferList 需要转移所有权的二进制数据
 * @returns Worker 执行结果
 * @author xiangwei
 */
function runWorkerRequest<TResult>(
    payload: SttWorkerRequestPayload,
    onProgress?: SttProgressCallback,
    transferList: ArrayBuffer[] = []
): Promise<TResult> {
    const worker = getSttWorker()
    const id = ++workerRequestId
    const request = { ...payload, id } as SttWorkerRequest

    return new Promise<TResult>((resolve, reject) => {
        pendingWorkerRequests.set(id, {
            resolve: (value) => resolve(value as TResult),
            reject,
            onProgress
        })
        try {
            worker.postMessage(request, transferList)
        } catch (error: unknown) {
            pendingWorkerRequests.delete(id)
            reject(error instanceof Error ? error : new Error(String(error)))
        }
    })
}

/**
 * 创建带日志的模型进度转发器
 *
 * @param onProgress 上层进度回调
 * @returns Worker 进度回调
 * @author xiangwei
 */
function createProgressReporter(onProgress?: SttProgressCallback): SttProgressCallback {
    const progressLog = new Map<string, number>()
    return (progress: SttProgressEvent) => {
        const file = progress.file ?? ''
        if (progress.status === 'initiate') {
            logger.info('STT', `开始加载 ${file}`)
        } else if (progress.status === 'progress' && progress.progress !== -1) {
            const percentage = Math.round(progress.progress ?? 0)
            const lastPercentage = progressLog.get(file) ?? -1
            if (percentage % 10 === 0 && percentage !== lastPercentage) {
                logger.info('STT', `${file} 加载中 ${percentage}%`)
                progressLog.set(file, percentage)
            }
        } else if (progress.status === 'done') {
            logger.info('STT', `${file} 加载完成`)
        }
        onProgress?.(progress)
    }
}

/**
 * 在工作线程中准备指定模型
 *
 * @param modelId 模型 ID
 * @param onProgress 模型进度回调
 * @author xiangwei
 */
async function prepareModel(modelId: string, onProgress?: SttProgressCallback): Promise<void> {
    const targetModel = modelId || DEFAULT_STT_MODEL_ID
    assertSupportedModelId(targetModel)

    if (initialized && currentModelId === targetModel) return

    if (initializationPromise) {
        if (currentModelId === targetModel) {
            await initializationPromise
            return
        }
        try {
            await initializationPromise
        } catch {
            // 前一个模型失败不应阻止用户切换到其他模型。
        }
    }

    const generation = runtimeGeneration
    initializing = true
    initialized = false
    currentModelId = targetModel
    initError = null
    logger.info('STT', `正在工作线程中加载 ${targetModel} 模型`)
    const workerProgress = createProgressReporter(onProgress)
    const request = runWorkerRequest<void>({ type: 'load', modelId: targetModel }, workerProgress)
    initializationPromise = request

    try {
        await request
        if (generation === runtimeGeneration) {
            initialized = true
            logger.info('STT', `${targetModel} 模型已在工作线程中加载完成`)
            onProgress?.({ status: 'ready', progress: 100 })
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : '模型加载失败'
        if (generation === runtimeGeneration) {
            initError = message
            currentModelId = targetModel
            logger.error('STT', `模型加载失败: ${message}`)
            onProgress?.({ status: 'error', error: message })
        }
        throw error
    } finally {
        if (generation === runtimeGeneration && initializationPromise === request) {
            initializing = false
            initializationPromise = null
        }
    }
}

/**
 * 下载并初始化指定模型（不进行转录）
 * 用于设置页面手动触发模型下载
 *
 * @param modelId 模型 ID
 * @param onProgress 下载进度回调
 * @author xiangwei
 */
export async function downloadModel(
    modelId: string,
    onProgress?: SttProgressCallback
): Promise<void> {
    await prepareModel(modelId, onProgress)
}

/**
 * 重置当前模型（切换模型时调用）
 * @author xiangwei
 */
export function resetModel(): void {
    runtimeGeneration += 1
    const worker = sttWorker
    sttWorker = null
    if (worker) {
        rejectPendingWorkerRequests(new Error('语音模型已重置'))
        void worker.terminate()
    }
    initialized = false
    initializing = false
    initializationPromise = null
    currentModelId = null
    initError = null
}

/**
 * 删除已下载的模型文件
 * 遍历缓存目录删除属于指定模型的子目录
 *
 * @param modelId 模型 ID
 * @returns 是否删除成功
 * @author xiangwei
 */
export function deleteModelFiles(modelId: string): boolean {
    const modelDir = getModelCacheDir(modelId)
    try {
        const cacheDir = getSttCacheDir()
        let deleted = false

        if (existsSync(cacheDir)) {
            // Transformers.js 缓存结构：{org}/{model}/onnx/*.onnx
            if (existsSync(modelDir)) {
                rmSync(modelDir, { recursive: true, force: true })
                logger.info('STT', `已删除模型缓存: ${modelDir}`)
                deleted = true
            }

            // 兼容旧缓存格式（models--org--model）：直接在缓存目录下按名称查找
            if (!deleted) {
                const entries = readdirSync(cacheDir, { withFileTypes: true })
                for (const entry of entries) {
                    if (entry.isDirectory() && entry.name.includes(modelId.replace(/.*\//, ''))) {
                        rmSync(join(cacheDir, entry.name), { recursive: true, force: true })
                        logger.info('STT', `已删除模型缓存: ${entry.name}`)
                        deleted = true
                        break
                    }
                }
            }
        }

        // 无论缓存文件是否找到，只要删除的是当前加载的模型就重置 pipeline
        // 防止 pipeline 内存缓存导致下次查询仍返回 ready
        if (currentModelId === modelId) {
            resetModel()
            logger.info('STT', `已重置模型状态: ${modelId}`)
        }

        if (!deleted) {
            logger.info('STT', `未找到模型缓存文件: ${modelId}，状态已重置`)
        }
        return true
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '删除失败'
        logger.error('STT', `删除模型缓存失败: ${msg}`)
        return false
    }
}

/**
 * 检查指定模型是否已缓存到本地磁盘
 *
 * Transformers.js 的缓存结构：{cacheDir}/{org}/{model}/onnx/*.onnx
 * 仅检查目录存在不够（可能只有元数据），必须确认 ONNX 模型文件已下载。
 *
 * @param modelId 模型 ID，例如 Xenova/whisper-base
 * @returns ONNX 模型文件是否完整存在于缓存目录
 * @author xiangwei
 */
export function isModelCached(modelId: string): boolean {
    const modelCacheDir = getModelCacheDir(modelId)
    const cacheDir = getSttCacheDir()
    if (!existsSync(cacheDir)) return false

    // Transformers.js 缓存结构：{org}/{model}/onnx/*.onnx
    const modelDir = join(modelCacheDir, 'onnx')
    if (!existsSync(modelDir)) return false

    // 检查是否有 ONNX 模型文件（encoder 或 decoder 至少一个）
    const entries = readdirSync(modelDir, { withFileTypes: true })
    return entries.some((entry) => entry.isFile() && entry.name.endsWith('.onnx'))
}

/**
 * 获取模型状态
 *
 * @param modelId 要查询的模型 ID（可选），如果指定则只返回该模型是否就绪
 * @returns 当前模型状态
 * @author xiangwei
 */
export function getModelStatus(modelId?: string): {
    status: 'none' | 'loading' | 'ready' | 'error'
    currentModel: string | null
    error: string | null
} {
    if (initializing) {
        if (modelId && currentModelId !== modelId) {
            return { status: 'none', currentModel: currentModelId, error: null }
        }
        return { status: 'loading', currentModel: currentModelId, error: null }
    }
    if (initialized) {
        // 如果指定了 modelId，检查是否匹配当前加载的模型
        if (modelId && currentModelId !== modelId) {
            return { status: 'none', currentModel: currentModelId, error: null }
        }
        return { status: 'ready', currentModel: currentModelId, error: null }
    }
    if (initError) {
        if (modelId && currentModelId !== modelId) {
            return { status: 'none', currentModel: currentModelId, error: null }
        }
        return { status: 'error', currentModel: currentModelId, error: initError }
    }
    return { status: 'none', currentModel: null, error: null }
}

/**
 * 将音频数据转录为文字
 *
 * @param audioData 16kHz 单声道 PCM 音频数据（Float32Array）
 * @param onProgress 模型下载进度回调（仅首次加载时触发）
 * @returns 转录文本
 * @author xiangwei
 */
export async function transcribeAudio(
    audioData: Float32Array,
    onProgress?: SttProgressCallback
): Promise<string> {
    const targetModel = currentModelId ?? DEFAULT_STT_MODEL_ID
    await prepareModel(targetModel, onProgress)

    logger.info('STT', '开始在工作线程中转录')
    const text = await runWorkerRequest<string>(
        { type: 'transcribe', modelId: targetModel, audioData },
        onProgress,
        [audioData.buffer as ArrayBuffer]
    )
    logger.info('STT', `转录完成：${text.length > 50 ? text.slice(0, 50) + '…' : text}`)
    onProgress?.({ status: 'done', progress: 100 })
    return text
}

/** @deprecated use getModelStatus() instead */
export function isModelLoading(): boolean {
    return initializing
}
