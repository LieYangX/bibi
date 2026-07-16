---
name: transaction-write
displayName: 记账
description: 记录新的流水或删除已有流水，按账户名称和分类名称自动匹配。
version: 1.0
author: system
---

# 记账 Skill

## 可用工具

| 工具               | 用途                                                          |
| ------------------ | ------------------------------------------------------------- |
| createTransaction  | 记录一笔流水（支出/收入/转账/调账），按账户名和分类名自动匹配 |
| deleteTransaction  | 软删除一笔流水，调用前必须先展示流水详情并获得用户明确确认    |
| queryAllAccounts   | 记账前查询可用账户名称                                        |
| queryAllCategories | 记账前查询可用分类名称（含二级分类）                          |

## 记账流程

1. 调用 queryAllAccounts 和 queryAllCategories 确认用户所说的账户和分类是否存在
2. 信息不完整时，引导用户补充类型、账户、金额、日期、分类和备注
3. 金额单位是“分”，用户说“35 元”时传入 3500
4. 用户未说明日期时使用当前日期
5. 调用 createTransaction 写入，展示工具返回的真实结果

## 删除流程

1. 通过 queryTransactions 或 queryRecentTransactions 找到目标流水的 ID
2. 展示目标流水的类型、账户、金额、日期和备注，明确询问是否确认删除
3. 只有用户明确确认后才能调用 deleteTransaction
4. 删除后展示工具返回的真实结果

## 使用规则

1. 所有工具已绑定当前用户，不传用户 ID
2. 不猜测账户或分类，必须以查询结果为准
3. 未经用户明确确认，不得删除任何流水
4. 禁止在文本中编造记账结果，必须调用工具完成实际写入
