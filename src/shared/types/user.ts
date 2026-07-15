/**
 * 共享类型定义 - 用户
 * @author xiangwei
 */

export interface User {
    id: string
    name: string
    color: string
    created_at: string
    updated_at: string
}

export interface CreateUserDTO {
    name: string
}

export interface UserListResult {
    users: User[]
    lastUserId: string | null
}
