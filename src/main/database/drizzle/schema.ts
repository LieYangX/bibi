/**
 * Drizzle ORM 表结构定义
 * 集中维护应用数据库表、外键与索引约束
 * @author xiangwei
 */

import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ============================================================
// 智能体对话表
// ============================================================
export const agentConversations = sqliteTable(
    'agent_conversations',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: text('title').notNull().default('新对话'),
        message_count: integer('message_count').notNull().default(0),
        model: text('model'),
        source: text('source').$type<'desktop' | 'wechat'>().notNull().default('desktop'),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_agent_conversations_user').on(table.user_id)]
)

// ============================================================
// 智能体消息表
// ============================================================
export const agentMessages = sqliteTable(
    'agent_messages',
    {
        id: text('id').primaryKey(),
        conversation_id: text('conversation_id')
            .notNull()
            .references(() => agentConversations.id, { onDelete: 'cascade' }),
        role: text('role').notNull(),
        content: text('content').notNull(),
        tool_calls: text('tool_calls'),
        tool_results: text('tool_results'),
        finish_reason: text('finish_reason'),
        skill_used: text('skill_used'),
        tool_used: text('tool_used'),
        thinking: text('thinking'),
        thinking_duration_ms: integer('thinking_duration_ms'),
        token_count: integer('token_count'),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_agent_messages_conversation').on(table.conversation_id)]
)

// ============================================================
// 用户表
// ============================================================
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#165DFF'),
    created_at: text('created_at')
        .notNull()
        .default(sql`(datetime('now', 'localtime'))`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`(datetime('now', 'localtime'))`)
})

// ============================================================
// 账户表
// ============================================================
export const accounts = sqliteTable(
    'accounts',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        type: text('type').notNull().default('bank'),
        initial_balance_cents: integer('initial_balance_cents').notNull().default(0),
        balance_cents: integer('balance_cents').notNull().default(0),
        sort_order: integer('sort_order').notNull().default(0),
        is_default: integer('is_default').notNull().default(0),
        is_hidden: integer('is_hidden').notNull().default(0),
        remark: text('remark').notNull().default(''),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        index('idx_accounts_user').on(table.user_id),
        uniqueIndex('idx_accounts_user_name').on(table.user_id, table.name)
    ]
)

// ============================================================
// 一级分类表
// ============================================================
export const categories = sqliteTable(
    'categories',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        name: text('name').notNull(),
        type: text('type').notNull(),
        icon: text('icon').notNull().default('IconBook'),
        color: text('color').notNull().default(''),
        is_system: integer('is_system').notNull().default(0),
        sort_order: integer('sort_order').notNull().default(0),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_categories_user_type').on(table.user_id, table.type)]
)

// ============================================================
// 二级分类表
// ============================================================
export const subCategories = sqliteTable('sub_categories', {
    id: text('id').primaryKey(),
    category_id: text('category_id')
        .notNull()
        .references(() => categories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sort_order: integer('sort_order').notNull().default(0),
    created_at: text('created_at')
        .notNull()
        .default(sql`(datetime('now', 'localtime'))`)
})

// ============================================================
// 流水表（核心）
// ============================================================
export const transactions = sqliteTable(
    'transactions',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        type: text('type').notNull(),
        account_id: text('account_id')
            .notNull()
            .references(() => accounts.id),
        target_account_id: text('target_account_id').references(() => accounts.id),
        category_id: text('category_id').references(() => categories.id),
        sub_category_id: text('sub_category_id').references(() => subCategories.id),
        amount_cents: integer('amount_cents').notNull(),
        date: text('date').notNull(),
        time: text('time'),
        note: text('note'),
        transfer_pair_id: text('transfer_pair_id'),
        is_deleted: integer('is_deleted').notNull().default(0),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        index('idx_transactions_user_date').on(table.user_id, table.date),
        index('idx_transactions_user_type').on(table.user_id, table.type),
        index('idx_transactions_user_account').on(table.user_id, table.account_id),
        index('idx_transactions_user_category').on(table.user_id, table.category_id)
    ]
)

// ============================================================
// 导入分类映射表
// ============================================================
export const importCategoryMappings = sqliteTable(
    'import_category_mappings',
    {
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        source: text('source').notNull(),
        item_type: text('item_type').notNull(),
        source_category: text('source_category').notNull(),
        category_id: text('category_id')
            .notNull()
            .references(() => categories.id, { onDelete: 'cascade' }),
        sub_category_id: text('sub_category_id').references(() => subCategories.id, {
            onDelete: 'cascade'
        }),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        uniqueIndex('idx_import_category_mappings_lookup').on(
            table.user_id,
            table.source,
            table.item_type,
            table.source_category
        ),
        index('idx_import_category_mappings_category').on(table.category_id),
        index('idx_import_category_mappings_sub_category').on(table.sub_category_id)
    ]
)

// ============================================================
// 导入账户映射表
// ============================================================
export const importAccountMappings = sqliteTable(
    'import_account_mappings',
    {
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        source: text('source').notNull(),
        role: text('role').notNull(),
        source_account_key: text('source_account_key').notNull(),
        account_id: text('account_id')
            .notNull()
            .references(() => accounts.id, { onDelete: 'cascade' }),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        uniqueIndex('idx_import_account_mappings_lookup').on(
            table.user_id,
            table.source,
            table.role,
            table.source_account_key
        ),
        index('idx_import_account_mappings_account').on(table.account_id)
    ]
)

// ============================================================
// 外部交易导入引用表
// ============================================================
export const transactionImportRefs = sqliteTable(
    'transaction_import_refs',
    {
        transaction_id: text('transaction_id')
            .notNull()
            .references(() => transactions.id, { onDelete: 'cascade' }),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        source: text('source').notNull(),
        external_id: text('external_id').notNull(),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        uniqueIndex('idx_transaction_import_refs_external').on(
            table.user_id,
            table.source,
            table.external_id
        ),
        index('idx_transaction_import_refs_transaction').on(table.transaction_id)
    ]
)

// ============================================================
// 预算表
// ============================================================
export const budgets = sqliteTable(
    'budgets',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        category_id: text('category_id').references(() => categories.id),
        year: integer('year').notNull(),
        month: integer('month').notNull(),
        amount_cents: integer('amount_cents').notNull(),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_budgets_user_year_month').on(table.user_id, table.year, table.month)]
)

// ============================================================
// 系统设置表
// 以 key-value 形式存储全局配置，value 统一按 JSON 字符串保存
// ============================================================
export const settings = sqliteTable(
    'settings',
    {
        key: text('key').primaryKey(),
        value: text('value').notNull(),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_settings_key').on(table.key)]
)

// ============================================================
// 用户待办表
// 极简纯任务清单，与记账解耦
// ============================================================
export const todos = sqliteTable(
    'todos',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        note: text('note'),
        status: text('status').$type<'pending' | 'completed'>().notNull().default('pending'),
        due_date: text('due_date'),
        due_time: text('due_time'),
        completed_at: text('completed_at'),
        sort_order: integer('sort_order').notNull().default(0),
        is_deleted: integer('is_deleted').notNull().default(0),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        index('idx_todos_user_status').on(table.user_id, table.status),
        index('idx_todos_user_due').on(table.user_id, table.due_date)
    ]
)

// ============================================================
// 智能体任务清单表
// 多步骤任务执行时由 Agent 自主创建，与用户待办物理隔离
// 绑定会话，会话删除时 cascade 清理
// ============================================================
export const agentTasks = sqliteTable(
    'agent_tasks',
    {
        id: text('id').primaryKey(),
        conversation_id: text('conversation_id')
            .notNull()
            .references(() => agentConversations.id, { onDelete: 'cascade' }),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        status: text('status').$type<'pending' | 'completed'>().notNull().default('pending'),
        sort_order: integer('sort_order').notNull().default(0),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [
        index('idx_agent_tasks_conversation').on(table.conversation_id),
        index('idx_agent_tasks_user_status').on(table.user_id, table.status)
    ]
)
