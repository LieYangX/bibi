import type { SttProgressEvent } from '@shared/types'

/** STT Worker 启动参数 */
export interface SttWorkerData {
    cacheDir: string
    remoteHost: string
}

/** STT Worker 请求 */
export type SttWorkerRequest =
    | {
          id: number
          type: 'load'
          modelId: string
      }
    | {
          id: number
          type: 'transcribe'
          modelId: string
          audioData: Float32Array
      }

/** STT Worker 响应 */
export type SttWorkerResponse =
    | {
          id: number
          type: 'progress'
          progress: SttProgressEvent
      }
    | {
          id: number
          type: 'result'
          result?: string
      }
    | {
          id: number
          type: 'error'
          error: string
      }
