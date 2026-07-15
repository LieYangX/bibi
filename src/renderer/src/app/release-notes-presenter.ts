/**
 * 更新公告展示能力注入契约
 *
 * @author xiangwei
 */

import type { InjectionKey } from 'vue'

/** 打开当前版本更新公告的方法 */
export type OpenReleaseNotes = () => Promise<void>

/** 更新公告展示能力注入键 */
export const openReleaseNotesKey: InjectionKey<OpenReleaseNotes> = Symbol('openReleaseNotes')
