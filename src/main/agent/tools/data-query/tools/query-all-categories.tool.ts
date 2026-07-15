/**
 * 分类列表查询工具 - 返回所有分类的名称和二级分类
 * 专为记账流程设计，帮助 AI 在记账前确认可用分类
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { listCategories } from '../../../../services/category.service'
import { getCurrentUserId } from '../../../../services/session.service'

export const queryAllCategoriesTool = tool({
    description: '查询所有支出和收入分类的完整列表（含二级分类），用于记账前确认可用分类',
    inputSchema: z.object({}),
    execute: async () => {
        const userId = await getCurrentUserId()
        if (!userId) throw new Error('请先选择用户')

        const expenseCategories = await listCategories(userId, 'expense')
        const incomeCategories = await listCategories(userId, 'income')

        let formatted = '## 可用分类\n\n'

        formatted += '### 支出分类\n'
        for (const cat of expenseCategories) {
            formatted += `- ${cat.name}`
            if (cat.sub_categories.length > 0) {
                const subNames = cat.sub_categories.map((s) => s.name).join('、')
                formatted += `（${subNames}）`
            }
            formatted += '\n'
        }

        formatted += '\n### 收入分类\n'
        for (const cat of incomeCategories) {
            formatted += `- ${cat.name}`
            if (cat.sub_categories.length > 0) {
                const subNames = cat.sub_categories.map((s) => s.name).join('、')
                formatted += `（${subNames}）`
            }
            formatted += '\n'
        }

        return {
            expense: expenseCategories.map((c) => ({
                name: c.name,
                sub_categories: c.sub_categories.map((s) => s.name)
            })),
            income: incomeCategories.map((c) => ({
                name: c.name,
                sub_categories: c.sub_categories.map((s) => s.name)
            })),
            formatted
        }
    }
})
