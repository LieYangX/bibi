/**
 * 应用版本更新公告
 *
 * @author xiangwei
 */

export interface ReleaseNotes {
    version: string
    date: string
    additions: string[]
    fixes: string[]
}

/** 可持久化版本已读状态的最小存储契约 */
export interface ReleaseNotesStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

const RELEASE_NOTES_STORAGE_KEY_PREFIX = 'bibi.release-notes.read.'

/** 首次进入新版本后展示更新公告的延迟时间 */
export const RELEASE_NOTES_DELAY_MS = 5_000

/** 已发布版本的更新公告，升级时在此追加新版本内容。 */
export const RELEASE_NOTES: Readonly<Record<string, ReleaseNotes>> = {
    '3.0.6': {
        version: '3.0.6',
        date: '2026-07-16',
        additions: ['记账支持记录交易时间，记一笔、AI 记账和账单导入均可填写时间。'],
        fixes: [
            '修复小笔呆呆的问题。调教了一下，嗯好多了',
            '优化微信渠道消息回复慢的问题，小优化哈哈哈哈不能太多了'
        ]
    },
    '3.0.5': {
        version: '3.0.5',
        date: '2026-07-15',
        additions: [
            '新增用户画像与灵魂两类本地 Markdown 记忆，AI 可按需维护用户画像。',
            '新增可配置的“记忆提炼阈值”，默认每 10 条用户消息自动更新一次灵魂。',
            '优化 AI 上下文管理：按需读取 Skill 完整内容，并结合滑动窗口、当前用户和运行环境构建上下文。',
            '小笔新增用户意图识别、复杂任务规划、目标核对和完成闭环能力。',
            '新增 AI 思考耗时记录，当前回答和历史会话均可查看思考时间。',
            '新增停止回答、消息排队、引导打断和队列消息删除功能。',
            '新增微信扫码连接，微信消息使用独立会话并完整复用现有模型、Skill、MCP、工具和记忆。',
            '微信连接凭证按笔笔用户隔离保存，程序重启或切换用户后可自动恢复连接。'
        ],
        fixes: [
            '修复进入小笔 AI 页面时未自动加载 MCP 状态，导致工具数量显示不准确的问题。',
            '修复 AI 回复在模型完成后才集中显示的问题，模型输出现在会实时传输到对话页面。',
            '修复回答开始后等待黄点仍持续显示，以及回答结束后等待状态未及时消失的问题。',
            '修复部分回答完成后输入框无法继续输入的问题，并将记忆提炼调整为后台执行。',
            '修复未开启深度思考时仍可能返回并展示思考信息的问题。',
            '优化回答期间的输入区状态：隐藏发送按钮并提供明确的停止回答操作。',
            '重构 Skill 与工具职责边界，并统一开发环境与打包环境的本地数据存储路径。'
        ]
    },
    '3.0.4': {
        version: '3.0.4',
        date: '2026-07-14',
        additions: [
            '小笔新增 MCP 服务管理，内置 Exa 网络检索服务。',
            'MCP 服务支持自定义新增、编辑、启停、删除和连接检测。',
            'AI 对话可同时调用本地 Skill 工具与已启用的 MCP 远程工具。',
            '工具面板新增 MCP 服务状态、远程工具列表和调用来源展示。',
            '设置页新增“更新内容”入口，可随时查看当前版本公告。',
            '首页顶部新增实时天气信息，自动展示当前位置、温度、湿度、风力和天气预警。'
        ],
        fixes: [
            '更新内容弹窗改为新版本首次进入五秒后展示，减少启动过程中的操作打断。',
            '增强远程工具异常隔离，单个 MCP 服务不可用时不影响本地技能和工具。',
            '优化工具调用结果展示，默认折叠并在用户展开时按需渲染，避免大数据量导致界面卡顿。',
            '优化语言转文字引擎加载时机导致界面卡顿的问题。'
        ]
    },
    '3.0.3': {
        version: '3.0.3',
        date: '2026-07-14',
        additions: [
            '流水页面新增一键回到顶部功能。',
            '小笔智能体页面 UI 调整。',
            '优化小笔智能体语音转文字功能启动逻辑。',
            '日志系统新增日志记录链路功能。'
        ],
        fixes: ['修复小笔智能体在回答过程中切换页面，返回后仍显示回答状态的问题。']
    }
}

/**
 * 获取指定版本的更新公告
 *
 * @param version 应用版本号
 * @returns 更新公告，不存在时返回 null
 * @author xiangwei
 */
export function getReleaseNotes(version: string): ReleaseNotes | null {
    return RELEASE_NOTES[version] ?? null
}

/**
 * 获取全部更新公告并按版本号从新到旧排列
 *
 * @returns 排序后的更新公告列表
 * @author xiangwei
 */
export function getAllReleaseNotes(): ReleaseNotes[] {
    return Object.values(RELEASE_NOTES).sort((left, right) => {
        const leftParts = left.version.split('.').map(Number)
        const rightParts = right.version.split('.').map(Number)
        const maxLength = Math.max(leftParts.length, rightParts.length)
        for (let index = 0; index < maxLength; index++) {
            const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0)
            if (difference !== 0) return difference
        }
        return 0
    })
}

/**
 * 判断用户是否已阅读指定版本公告
 *
 * @param storage 已读状态存储器
 * @param release 更新公告
 * @returns 是否已读
 * @author xiangwei
 */
export function hasReadReleaseNotes(storage: ReleaseNotesStorage, release: ReleaseNotes): boolean {
    return storage.getItem(getReleaseNotesStorageKey(release.version)) === release.version
}

/**
 * 标记指定版本公告已读
 *
 * @param storage 已读状态存储器
 * @param release 更新公告
 * @author xiangwei
 */
export function markReleaseNotesRead(storage: ReleaseNotesStorage, release: ReleaseNotes): void {
    storage.setItem(getReleaseNotesStorageKey(release.version), release.version)
}

/**
 * 获取版本公告已读状态的存储键
 *
 * @param version 应用版本号
 * @returns 存储键
 * @author xiangwei
 */
function getReleaseNotesStorageKey(version: string): string {
    return `${RELEASE_NOTES_STORAGE_KEY_PREFIX}${version}`
}
