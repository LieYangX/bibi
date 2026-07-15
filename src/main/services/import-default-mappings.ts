/**
 * 渠道分类到笔笔默认一级分类的建议规则
 * @author xiangwei
 */

import type { ImportSource } from '@shared/types'

type ImportTransactionType = 'expense' | 'income'

const ALIPAY_EXPENSE_CATEGORY_NAMES: Record<string, string> = {
    餐饮美食: '餐饮',
    服饰装扮: '购物',
    日用百货: '购物',
    家居家装: '居家',
    数码电器: '购物',
    运动户外: '娱乐',
    美容美发: '购物',
    母婴亲子: '居家',
    宠物: '居家',
    交通出行: '交通',
    爱车养车: '交通',
    住房物业: '居家',
    酒店旅游: '娱乐',
    文化休闲: '娱乐',
    教育培训: '教育',
    医疗健康: '医疗',
    生活服务: '居家',
    公益捐赠: '人情',
    亲友代付: '人情',
    转账红包: '人情',
    充值缴费: '通讯'
}

const ALIPAY_INCOME_CATEGORY_NAMES: Record<string, string> = {
    投资理财: '理财',
    退款: '报销退款',
    转账红包: '其他收入'
}

const WECHAT_EXPENSE_CATEGORY_NAMES: Record<string, string> = {
    微信红包: '人情',
    '微信红包（单发）': '人情',
    红包: '人情'
}

const WECHAT_INCOME_CATEGORY_NAMES: Record<string, string> = {
    微信红包: '报销退款',
    '微信红包（单发）': '报销退款',
    红包: '报销退款',
    有退款: '报销退款'
}

/**
 * 获取来源分类对应的笔笔默认一级分类名称
 *
 * @param source 导入渠道
 * @param type 收支类型
 * @param sourceCategory 来源分类
 * @returns 笔笔默认一级分类名称
 * @author xiangwei
 */
export function getDefaultImportCategoryName(
    source: ImportSource,
    type: ImportTransactionType,
    sourceCategory: string
): string {
    if (source === 'alipay') {
        const mappings =
            type === 'expense' ? ALIPAY_EXPENSE_CATEGORY_NAMES : ALIPAY_INCOME_CATEGORY_NAMES
        return mappings[sourceCategory] ?? (type === 'expense' ? '其他支出' : '其他收入')
    }

    const mappings =
        type === 'expense' ? WECHAT_EXPENSE_CATEGORY_NAMES : WECHAT_INCOME_CATEGORY_NAMES
    return mappings[sourceCategory] ?? (type === 'expense' ? '其他支出' : '其他收入')
}
