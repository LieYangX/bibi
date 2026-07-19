/**
 * IPC 参数运行时校验规则
 * @author xiangwei
 */

import { z } from 'zod'
import {
    MAX_MEMORY_DISTILLATION_THRESHOLD,
    MIN_MEMORY_DISTILLATION_THRESHOLD,
    STT_MODEL_IDS
} from '../types/agent'

const MAX_AGENT_MESSAGE_LENGTH = 20_000
const MAX_SKILL_MARKDOWN_LENGTH = 100_000
const MAX_STT_AUDIO_BYTES = 40 * 1024 * 1024
const MAX_BATCH_DELETE_ITEMS = 200
const MAX_MCP_HEADERS = 20

const idSchema = z.string().trim().min(1).max(100)
const nameSchema = z.string().trim().min(1).max(50)
const dateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
        const [year, month, day] = value.split('-').map(Number)
        const date = new Date(Date.UTC(year, month - 1, day))
        return (
            date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day
        )
    }, '日期不存在')
const timeSchema = z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .refine((value) => {
        const [hour, minute] = value.split(':').map(Number)
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
    }, '时间格式必须为 HH:mm 且合法')
const amountSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const accountTypeSchema = z.enum(['bank', 'wechat', 'alipay', 'cash', 'credit', 'other'])
const categoryTypeSchema = z.enum(['expense', 'income'])
const transactionTypeSchema = z.enum(['expense', 'income', 'transfer', 'adjustment'])
const importSourceSchema = z.enum(['alipay', 'wechat'])
const importItemTypeSchema = z.enum(['expense', 'income', 'skip'])
const importTransactionTypeSchema = z.enum(['expense', 'income'])
const importAccountRoleSchema = z.enum(['payment', 'receipt'])
const sttModelIdSchema = z.enum(STT_MODEL_IDS)
const themeModeSchema = z.enum(['light', 'dark', 'system'])
const skillNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, '只能包含小写字母、数字和连字符')
const mcpServerNameSchema = z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, '只能包含字母、数字、下划线和连字符')
const mcpServerUrlSchema = z
    .string()
    .trim()
    .url('请输入有效的 MCP 服务地址')
    .max(2_000)
    .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
        message: 'MCP 服务地址仅支持 HTTP 或 HTTPS'
    })
const mcpHeadersSchema = z
    .record(z.string().trim().min(1).max(100), z.string().max(2_000))
    .refine((headers) => Object.keys(headers).length <= MAX_MCP_HEADERS, {
        message: `MCP 请求头不能超过 ${MAX_MCP_HEADERS} 个`
    })
const sttAudioSchema = z
    .instanceof(ArrayBuffer)
    .refine((value) => value.byteLength > 0, '音频数据不能为空')
    .refine(
        (value) => value.byteLength <= MAX_STT_AUDIO_BYTES,
        `音频数据不能超过 ${MAX_STT_AUDIO_BYTES} 字节`
    )
    .refine((value) => value.byteLength % Float32Array.BYTES_PER_ELEMENT === 0, '音频数据长度无效')
const agentMessageCursorSchema = z
    .object({
        created_at: z.string().trim().min(1).max(50),
        id: idSchema
    })
    .strict()
const conversationCursorSchema = z
    .object({
        updated_at: z.string().trim().min(1).max(50),
        id: idSchema
    })
    .strict()

const createAccountSchema = z
    .object({
        name: nameSchema,
        type: accountTypeSchema,
        initial_balance_cents: z.number().int().safe(),
        is_default: z.boolean().optional(),
        remark: z.string().max(200).optional()
    })
    .strict()

const updateAccountSchema = z
    .object({
        name: nameSchema.optional(),
        type: accountTypeSchema.optional(),
        is_default: z.boolean().optional(),
        remark: z.string().max(200).optional()
    })
    .strict()

const colorSchema = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, '颜色格式必须为 #RRGGBB')
    .optional()

const createCategorySchema = z
    .object({
        name: nameSchema,
        type: categoryTypeSchema,
        icon: z.string().trim().min(1).max(50).optional(),
        color: colorSchema
    })
    .strict()

const updateCategorySchema = z
    .object({
        name: nameSchema.optional(),
        icon: z.string().trim().min(1).max(50).optional(),
        color: colorSchema
    })
    .strict()

const transactionFields = {
    type: transactionTypeSchema,
    account_id: idSchema,
    target_account_id: idSchema.nullish(),
    category_id: idSchema.nullish(),
    sub_category_id: idSchema.nullish(),
    amount_cents: amountSchema,
    date: dateSchema,
    time: timeSchema.nullish(),
    note: z.string().max(500).nullish()
}

function validateCategoryHierarchy(
    value: { category_id?: string | null; sub_category_id?: string | null },
    context: z.RefinementCtx
): void {
    if (value.sub_category_id && !value.category_id) {
        context.addIssue({
            code: 'custom',
            path: ['sub_category_id'],
            message: '选择二级分类时必须选择一级分类'
        })
    }
}

const createTransactionSchema = z
    .object(transactionFields)
    .strict()
    .superRefine(validateCategoryHierarchy)

const updateTransactionSchema = z
    .object({
        type: transactionFields.type.optional(),
        account_id: transactionFields.account_id.optional(),
        target_account_id: transactionFields.target_account_id.optional(),
        category_id: transactionFields.category_id.optional(),
        sub_category_id: transactionFields.sub_category_id.optional(),
        amount_cents: transactionFields.amount_cents.optional(),
        date: transactionFields.date.optional(),
        time: transactionFields.time.optional(),
        note: transactionFields.note.optional()
    })
    .strict()
    .superRefine((value, context) => {
        // 更新时只有显式清空一级分类并保留二级分类才可在参数层直接判定非法
        if (value.category_id === null && value.sub_category_id) {
            validateCategoryHierarchy(value, context)
        }
    })

const transactionFilterSchema = z
    .object({
        start_date: dateSchema.optional(),
        end_date: dateSchema.optional(),
        type: z.enum(['all', 'expense', 'income', 'transfer', 'adjustment']).optional(),
        account_id: idSchema.optional(),
        category_id: idSchema.optional(),
        keyword: z.string().max(100).optional(),
        sort_field: z.enum(['date', 'amount_cents']).optional(),
        sort_order: z.enum(['asc', 'desc']).optional(),
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(200).optional(),
        cursor: z
            .object({
                date: dateSchema,
                id: idSchema
            })
            .strict()
            .optional()
    })
    .strict()
    .refine((value) => !value.start_date || !value.end_date || value.start_date <= value.end_date, {
        path: ['end_date'],
        message: '结束日期不能早于开始日期'
    })

const budgetSchema = z
    .object({
        category_id: idSchema.nullish(),
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(0).max(12),
        amount_cents: amountSchema
    })
    .strict()

const todoStatusSchema = z.enum(['pending', 'completed'])
const todoTitleSchema = z.string().trim().min(1).max(200)

const createTodoSchema = z
    .object({
        title: todoTitleSchema,
        note: z.string().max(500).nullish(),
        due_date: dateSchema.nullish(),
        due_time: timeSchema.nullish()
    })
    .strict()

const updateTodoSchema = z
    .object({
        title: todoTitleSchema.optional(),
        note: z.string().max(500).nullish(),
        due_date: dateSchema.nullable().optional(),
        due_time: timeSchema.nullable().optional()
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, '至少修改一个字段')

const todoListFilterSchema = z
    .object({
        status: todoStatusSchema.optional(),
        due_start: dateSchema.optional(),
        due_end: dateSchema.optional(),
        keyword: z.string().max(100).optional()
    })
    .strict()
    .refine((value) => !value.due_start || !value.due_end || value.due_start <= value.due_end, {
        path: ['due_end'],
        message: '结束日期不能早于开始日期'
    })

const importDraftRowChangesSchema = z
    .object({
        included: z.boolean().optional(),
        type: importItemTypeSchema.optional(),
        account_id: idSchema.nullable().optional(),
        category_id: idSchema.nullable().optional(),
        sub_category_id: idSchema.nullable().optional(),
        note: z.string().max(500).optional()
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0, '至少修改一个字段')

const importDraftOperationSchema = z.discriminatedUnion('kind', [
    z
        .object({
            kind: z.literal('set-included'),
            item_ids: z.array(idSchema).min(1).max(5_000),
            included: z.boolean()
        })
        .strict(),
    z
        .object({
            kind: z.literal('map-category'),
            item_type: importTransactionTypeSchema,
            source_category: z.string().trim().min(1).max(50),
            category_id: idSchema.nullable(),
            sub_category_id: idSchema.nullable()
        })
        .strict(),
    z
        .object({
            kind: z.literal('map-account'),
            role: importAccountRoleSchema,
            source_account_key: z.string().trim().min(1).max(100),
            account_id: idSchema.nullable()
        })
        .strict(),
    z
        .object({
            kind: z.literal('bulk-account'),
            item_type: importTransactionTypeSchema,
            account_id: idSchema.nullable()
        })
        .strict(),
    z
        .object({
            kind: z.literal('update-item'),
            item_id: idSchema,
            changes: importDraftRowChangesSchema
        })
        .strict()
])

export const IPC_SCHEMAS = {
    none: z.tuple([]),
    user: {
        create: z.tuple([nameSchema]),
        switch: z.tuple([idSchema]),
        delete: z.tuple([idSchema])
    },
    account: {
        create: z.tuple([createAccountSchema]),
        update: z.tuple([idSchema, updateAccountSchema]),
        delete: z.tuple([idSchema])
    },
    category: {
        list: z.tuple([z.union([categoryTypeSchema, z.undefined()])]),
        create: z.tuple([createCategorySchema]),
        update: z.tuple([idSchema, updateCategorySchema]),
        delete: z.tuple([idSchema]),
        createSub: z.tuple([z.object({ category_id: idSchema, name: nameSchema }).strict()]),
        updateSub: z.tuple([idSchema, z.object({ name: nameSchema }).strict()]),
        deleteSub: z.tuple([idSchema])
    },
    transaction: {
        create: z.tuple([createTransactionSchema]),
        update: z.tuple([idSchema, updateTransactionSchema]),
        delete: z.tuple([idSchema]),
        batchDelete: z.tuple([
            z
                .array(idSchema)
                .min(1)
                .max(MAX_BATCH_DELETE_ITEMS)
                .refine((ids) => new Set(ids).size === ids.length, '流水 ID 不能重复')
        ]),
        list: z.tuple([transactionFilterSchema]),
        getById: z.tuple([idSchema]),
        export: z.tuple([transactionFilterSchema])
    },
    budget: {
        set: z.tuple([budgetSchema]),
        getMonth: z.tuple([z.number().int().min(2000).max(2100), z.number().int().min(1).max(12)]),
        getYear: z.tuple([z.number().int().min(2000).max(2100)]),
        delete: z.tuple([idSchema])
    },
    todo: {
        list: z.tuple([todoListFilterSchema]),
        create: z.tuple([createTodoSchema]),
        update: z.tuple([idSchema, updateTodoSchema]),
        delete: z.tuple([idSchema]),
        toggle: z.tuple([idSchema])
    },
    statistics: {
        getMonthly: z.tuple([
            z.number().int().min(2000).max(2100),
            z.number().int().min(1).max(12)
        ]),
        getAnnual: z.tuple([z.number().int().min(2000).max(2100)])
    },
    weather: {
        getCurrent: z.tuple([z.union([z.boolean(), z.undefined()])])
    },
    import: {
        selectFile: z.tuple([importSourceSchema]),
        parseFile: z.tuple([idSchema, importSourceSchema]),
        updateDraft: z.tuple([
            z
                .object({
                    draft_id: idSchema,
                    revision: z.number().int().min(0),
                    operation: importDraftOperationSchema
                })
                .strict()
        ]),
        confirmDraft: z.tuple([
            z
                .object({
                    draft_id: idSchema,
                    revision: z.number().int().min(0),
                    remember_mappings: z.boolean()
                })
                .strict()
        ]),
        discardDraft: z.tuple([z.object({ draft_id: idSchema }).strict()])
    },
    setting: {
        get: z.union([
            z.tuple([z.literal('amount_mask'), z.union([z.boolean(), z.undefined()])]),
            z.tuple([
                z.literal('agent_context_panel_visible'),
                z.union([z.boolean(), z.undefined()])
            ]),
            z.tuple([z.literal('stt_enabled'), z.union([z.boolean(), z.undefined()])]),
            z.tuple([z.literal('stt_model'), z.union([sttModelIdSchema, z.undefined()])]),
            z.tuple([z.literal('theme'), z.union([themeModeSchema, z.undefined()])]),
            z.tuple([
                z.literal('last_conversation_id'),
                z.union([z.string(), z.null(), z.undefined()])
            ])
        ]),
        set: z.union([
            z.tuple([z.literal('amount_mask'), z.boolean()]),
            z.tuple([z.literal('agent_context_panel_visible'), z.boolean()]),
            z.tuple([z.literal('stt_enabled'), z.boolean()]),
            z.tuple([z.literal('stt_model'), sttModelIdSchema]),
            z.tuple([z.literal('theme'), themeModeSchema]),
            z.tuple([z.literal('last_conversation_id'), z.union([z.string(), z.null()])])
        ])
    },
    app: {
        reportRendererError: z.tuple([
            z
                .object({
                    kind: z.enum(['error', 'unhandledrejection', 'vue']),
                    message: z.string().trim().min(1).max(2_000),
                    stack: z.string().max(8_000).optional(),
                    source: z.string().max(500).optional()
                })
                .strict()
        ]),
        setAutoLaunch: z.tuple([z.boolean()]),
        getAutoLaunch: z.tuple([])
    },
    window: {
        setMinimizePreference: z.tuple([z.boolean()])
    },
    agent: {
        connectWechat: z.tuple([]),
        disconnectWechat: z.tuple([]),
        getWechatStatus: z.tuple([]),
        chat: z.tuple([
            idSchema.nullable(),
            z
                .string()
                .min(1)
                .max(MAX_AGENT_MESSAGE_LENGTH)
                .refine((value) => value.trim().length > 0, '消息不能为空'),
            z.boolean()
        ]),
        transcribeAudio: z.tuple([sttAudioSchema]),
        sttDownloadModel: z.tuple([sttModelIdSchema]),
        sttModelStatus: z.tuple([sttModelIdSchema.optional()]),
        sttDeleteModel: z.tuple([sttModelIdSchema]),
        listConversations: z.tuple([z.union([conversationCursorSchema, z.undefined()])]),
        deleteConversation: z.tuple([z.string().trim().min(1).max(100)]),
        getConversation: z.tuple([
            z.string().trim().min(1).max(100),
            z.union([agentMessageCursorSchema, z.undefined()])
        ]),
        updateConfig: z.tuple([
            z
                .object({
                    apiKey: z.string().optional(),
                    model: z.string().optional(),
                    temperature: z.number().min(0).max(2).optional(),
                    maxTokens: z.number().int().min(1).max(32000).optional(),
                    memoryDistillationThreshold: z
                        .number()
                        .int()
                        .min(MIN_MEMORY_DISTILLATION_THRESHOLD)
                        .max(MAX_MEMORY_DISTILLATION_THRESHOLD)
                        .optional(),
                    enabled: z.boolean().optional()
                })
                .strict()
        ]),
        toggleSkill: z.tuple([z.string().trim().min(1).max(100), z.boolean()]),
        getSkillDetail: z.tuple([z.string().trim().min(1).max(100)]),
        renameConversation: z.tuple([
            z.string().trim().min(1).max(100),
            z.string().trim().min(1).max(100)
        ]),
        getToolCallCounts: z.tuple([]),
        setToolCallCounts: z.tuple([z.record(z.string(), z.number().int().min(0))]),
        createSkill: z.tuple([
            z
                .object({
                    name: skillNameSchema,
                    displayName: z.string().trim().min(1).max(50),
                    description: z.string().trim().min(1).max(200),
                    markdown: z.string().trim().min(1).max(MAX_SKILL_MARKDOWN_LENGTH)
                })
                .strict()
        ]),
        deleteSkill: z.tuple([skillNameSchema]),
        saveMcpServer: z.tuple([
            z
                .object({
                    previousName: mcpServerNameSchema.optional(),
                    name: mcpServerNameSchema,
                    url: mcpServerUrlSchema,
                    headers: mcpHeadersSchema,
                    enabled: z.boolean()
                })
                .strict()
        ]),
        deleteMcpServer: z.tuple([mcpServerNameSchema]),
        toggleMcpServer: z.tuple([mcpServerNameSchema, z.boolean()]),
        inspectMcpServer: z.tuple([mcpServerNameSchema]),
        listTasks: z.tuple([idSchema]),
        clearTasks: z.tuple([idSchema])
    }
} as const
