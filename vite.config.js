import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// `npm run demo` (mode "demo") runs the app on built-in sample data, no Supabase needed.
// Every other mode swaps the demo data out so it never ships.
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'
  return {
    plugins: [react()],
    define: isDemo ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
    resolve: {
      alias: isDemo ? [] : [{ find: /^\.\/demo-supabase\.js$/, replacement: fileURLToPath(new URL('./src/lib/demo-off.js', import.meta.url)) }],
    },
  }
})
