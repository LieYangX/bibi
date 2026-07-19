---
name: user-todo
displayName: 待办管理
description: 帮用户创建、查询、修改、删除待办事项
version: 1.0
author: system
---

# 待办管理 Skill

## 可用工具

| 工具           | 用途                                     |
| -------------- | ---------------------------------------- |
| createUserTodo | 创建待办                                 |
| deleteUserTodo | 删除待办（按 ID 或标题关键字）           |
| queryUserTodos | 查询待办列表（支持状态/日期/关键字过滤） |
| updateUserTodo | 修改待办标题或截止日期                   |

## 使用场景

- 用户说"帮我记个待办：明天交水电费" -> createUserTodo
- 用户说"我有什么待办" -> queryUserTodos
- 用户说"把交水电费改到后天" -> updateUserTodo
- 用户说"删掉交水电费的待办" -> deleteUserTodo

## 使用规则

1. 所有工具已绑定当前用户，不传用户 ID
2. 删除/修改时优先用 ID，无 ID 时用标题关键字模糊匹配
3. 模糊匹配多条结果时，返回列表让用户选择，不自动猜测
4. 创建待办时如用户未指定截止日期，不主动设置
5. 查询时默认返回全部状态，用户要求"未完成"时才传 status=pending
