import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'

// `npm run demo` (mode "demo") runs the app on built-in sample data, no Supabase needed.
// Every other mode swaps the demo data out so it never ships.
export default defineConfig(({ mode }) => {
  const isDemo = mode === 'demo'

  // Vercel's Supabase integration adds SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY
  // (or SUPABASE_ANON_KEY). Vite normally hides anything not starting with VITE_,
  // so pass through exactly these two public values. Never add the service-role
  // key or JWT secret here: anything defined below ends up in the browser.
  const env = loadEnv(mode, process.cwd(), '')
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
    || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''

  // The public address for invite and sign-in links. Vercel sets
  // VERCEL_PROJECT_PRODUCTION_URL (e.g. bozo-bets-psi.vercel.app) on every build.
  // Only production builds use it, so preview links still point at the preview.
  const site = env.VITE_SITE_URL
    || (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '')

  return {
    plugins: [react()],
    define: isDemo
      ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1'), 'import.meta.env.VITE_SITE_URL': JSON.stringify(site) }
      : {
          'import.meta.env.VITE_SITE_URL': JSON.stringify(site),
          'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
          'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(key),
        },
    resolve: {
      alias: isDemo ? [] : [{ find: /^\.\/demo-supabase\.js$/, replacement: fileURLToPath(new URL('./src/lib/demo-off.js', import.meta.url)) }],
    },
  }
})
