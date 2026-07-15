import { describe, expect, it } from 'vitest'
import { resolveAppDataRoot } from '../../src/main/utils/app-data-path'

describe('应用运行数据路径', () => {
    it('开发环境使用项目根目录', () => {
        expect(
            resolveAppDataRoot({
                isPackaged: false,
                appPath: 'C:\\workspace\\bibi',
                userDataPath: 'C:\\Users\\tester\\AppData\\Roaming\\bibi'
            })
        ).toBe('C:\\workspace\\bibi')
    })

    it('打包后使用用户数据目录', () => {
        expect(
            resolveAppDataRoot({
                isPackaged: true,
                appPath: 'C:\\Program Files\\bibi\\resources\\app.asar',
                userDataPath: 'C:\\Users\\tester\\AppData\\Roaming\\bibi'
            })
        ).toBe('C:\\Users\\tester\\AppData\\Roaming\\bibi')
    })
})
