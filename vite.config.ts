import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { fileURLToPath, URL } from 'node:url'

/**
 * Serve an atproto OAuth client-metadata document built from the request's
 * host, so OAuth works over any HTTPS origin the dev server is reached at (e.g.
 * a Cloudflare quick tunnel) without hardcoding the URL. Loopback origins use
 * the in-app loopback client instead and never hit this.
 */
function oauthClientMetadata(): Plugin {
  const SCOPE = 'atproto transition:generic transition:chat.bsky'
  return {
    name: 'oauth-client-metadata',
    configureServer(server) {
      server.middlewares.use('/client-metadata.json', (req, res) => {
        const host = (req.headers['x-forwarded-host'] as string) || req.headers.host
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
        const origin = `${proto}://${host}`
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            client_id: `${origin}/client-metadata.json`,
            client_name: 'Ovoid',
            redirect_uris: [`${origin}/oauth/callback`],
            scope: SCOPE,
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            application_type: 'web',
            dpop_bound_access_tokens: true,
          }),
        )
      })
    },
  }
}

// Dev server is bound to 127.0.0.1:5173 so the atproto OAuth loopback
// client_id (http://localhost) resolves against a stable origin.
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    oauthClientMetadata(),
    // Upload source maps to Sentry only when a token is configured (e.g. CI).
    // Without SENTRY_AUTH_TOKEN this is omitted, so local/normal builds are
    // unaffected. Must come after other plugins.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // 'hidden' emits source maps (for Sentry upload) without referencing them in
    // the shipped bundles, so stack traces de-minify in Sentry but maps aren't
    // exposed to users.
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing deps out of the app chunk so the critical
        // path isn't dominated by @atproto/api. hls.js stays a dynamic import.
        manualChunks: {
          atproto: ['@atproto/api', '@atproto/oauth-client-browser'],
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            '@tanstack/react-query',
            '@tanstack/react-virtual',
            'zustand',
            'clsx',
          ],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Allow Cloudflare quick-tunnel hosts to reach the dev server.
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
