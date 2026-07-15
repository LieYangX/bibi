/**
 * STT 模型工作线程
 *
 * Transformers 和 ONNX 的模型初始化、语音推理均在此线程执行，
 * 避免计算密集型任务阻塞 Electron 主线程。
 *
 * @author xiangwei
 */

import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'
import { parentPort, workerData } from 'node:worker_threads'
import type { SttWorkerData, SttWorkerRequest, SttWorkerResponse } from './stt-worker.types'

type TransformersModule = typeof import('@huggingface/transformers')
type TextConverter = (value: string) => string

const port = parentPort
if (!port) {
    throw new Error('STT Worker 缺少父线程通信端口')
}
const workerPort = port

const config = workerData as SttWorkerData
let transformersModulePromise: Promise<TransformersModule> | null = null
let textConverterPromise: Promise<TextConverter> | null = null
let transcriber: AutomaticSpeechRecognitionPipeline | null = null
let currentModelId: string | null = null
let taskQueue = Promise.resolve()

/**
 * 向主线程发送响应
 *
 * @param response Worker 响应
 * @author xiangwei
 */
function postResponse(response: SttWorkerResponse): void {
    workerPort.postMessage(response)
}

/**
 * 按需加载 Transformers 运行库
 *
 * @returns Transformers 模块
 * @author xiangwei
 */
async function loadTransformersModule(): Promise<TransformersModule> {
    if (!transformersModulePromise) {
        transformersModulePromise = import('@huggingface/transformers').then((module) => {
            module.env.cacheDir = config.cacheDir
            module.env.remoteHost = config.remoteHost
            return module
        })
    }
    return transformersModulePromise
}

/**
 * 按需创建繁体转简体转换器
 *
 * @returns 文本转换器
 * @author xiangwei
 */
async function loadTextConverter(): Promise<TextConverter> {
    if (!textConverterPromise) {
        textConverterPromise = import('opencc-js').then(({ Converter }) =>
            Converter({ from: 't', to: 'cn' })
        )
    }
    return textConverterPromise
}

/**
 * 释放当前模型占用的资源
 *
 * @author xiangwei
 */
async function disposeTranscriber(): Promise<void> {
    const disposable = transcriber as
        (AutomaticSpeechRecognitionPipeline & { dispose?: () => void | Promise<void> }) | null
    await disposable?.dispose?.()
    transcriber = null
    currentModelId = null
}

/**
 * 获取或初始化指定语音模型
 *
 * @param requestId 请求编号
 * @param modelId 模型 ID
 * @returns 语音识别管线
 * @author xiangwei
 */
async function getTranscriber(
    requestId: number,
    modelId: string
): Promise<AutomaticSpeechRecognitionPipeline> {
    if (transcriber && currentModelId === modelId) return transcriber

    if (transcriber) {
        await disposeTranscriber()
    }

    const { pipeline } = await loadTransformersModule()
    currentModelId = modelId
    postResponse({
        id: requestId,
        type: 'progress',
        progress: { status: 'initiate', progress: 0, file: modelId }
    })

    try {
        transcriber = (await pipeline('automatic-speech-recognition', modelId, {
            progress_callback: (data: {
                status: string
                name?: string
                file?: string
                progress?: number
                loaded?: number
                total?: number
            }) => {
                const file = data.file ?? data.name ?? ''
                if (
                    data.status !== 'initiate' &&
                    data.status !== 'download' &&
                    data.status !== 'progress' &&
                    data.status !== 'done'
                ) {
                    return
                }
                postResponse({
                    id: requestId,
                    type: 'progress',
                    progress: {
                        status: data.status,
                        file,
                        progress: data.status === 'done' ? 100 : data.progress,
                        loaded: data.loaded,
                        total: data.total
                    }
                })
            }
        })) as unknown as AutomaticSpeechRecognitionPipeline
        return transcriber
    } catch (error: unknown) {
        transcriber = null
        currentModelId = null
        throw error
    }
}

/**
 * 执行单个 STT 请求
 *
 * @param request Worker 请求
 * @author xiangwei
 */
async function handleRequest(request: SttWorkerRequest): Promise<void> {
    try {
        const pipe = await getTranscriber(request.id, request.modelId)
        if (request.type === 'load') {
            postResponse({ id: request.id, type: 'result' })
            return
        }

        postResponse({
            id: request.id,
            type: 'progress',
            progress: { status: 'progress', progress: -1 }
        })
        const result = await pipe(request.audioData, {
            language: 'zh',
            task: 'transcribe',
            return_timestamps: false
        })
        const textConverter = await loadTextConverter()
        const text = textConverter((result as { text: string }).text.trim())
        postResponse({ id: request.id, type: 'result', result: text })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        postResponse({ id: request.id, type: 'error', error: message })
    }
}

workerPort.on('message', (request: SttWorkerRequest) => {
    // 模型切换与推理必须串行，避免共享管线被并发替换。
    taskQueue = taskQueue.then(() => handleRequest(request))
})
