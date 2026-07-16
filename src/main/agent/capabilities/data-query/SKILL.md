---
name: data-query
displayName: 数据查询
description: 查询数据库中的流水、账户、预算、统计信息。适合用户询问"花了多少""余额""预算情况""某分类支出"时使用。
version: 1.0
author: system
---

# 数据查询 Skill

## 可用工具

| 工具                    | 用途                                                         |
| ----------------------- | ------------------------------------------------------------ |
| queryTransactions       | 按日期范围、类型、分类、关键词多条件查询流水                 |
| queryRecentTransactions | 查询最近 N 笔流水，可按类型过滤、按金额排序                  |
| queryAccountBalance     | 查询所有账户余额                                             |
| queryMonthlySummary     | 指定月份收支汇总（总收入、总支出、结余、分类占比、每日趋势） |
| queryYearlySummary      | 指定年份收支汇总（总收入、总支出、月度趋势、分类占比）       |
| queryCategorySummary    | 指定时间段各分类收支汇总和占比                               |
| queryBudgetProgress     | 指定月份预算执行进度                                         |
| queryAllAccounts        | 查询所有账户名称和类型（记账前确认可用账户）                 |
| queryAllCategories      | 查询所有支出和收入分类（含二级，记账前确认可用分类）         |

## 使用规则

1. 所有查询自动限制在当前用户范围内，不传用户 ID
2. 优先选择最精确的查询工具，避免拉取冗余数据
3. 金额单位为“分”，展示给用户时换算为“元”
4. 查询结果为空时友好提示“该时间段没有记录”或“分类下暂无数据”
5. 涉及百分比变化或数值对比时，直接使用 compareValues 工具计算，不口算
