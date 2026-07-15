import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    schema: './src/main/database/drizzle/schema.ts',
    out: './src/main/database/drizzle/migrations',
    dialect: 'sqlite'
})
