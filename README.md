# Ovoid

A frontend-only Bluesky (atproto) client. React 18 + TypeScript + Vite, talking
directly to the user's PDS over OAuth — no backend of our own.

## Quick start

```bash
npm install && npm run dev
```

The dev server binds to **http://127.0.0.1:5173** (not `localhost`, and the port
is fixed). This matters for OAuth — see below.

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Vite dev server on 127.0.0.1:5173     |
| `npm run build`     | Type-check then production bundle      |
| `npm run preview`   | Serve the built bundle                 |
| `npm run typecheck` | `tsc --noEmit`                         |

## OAuth notes

Auth uses `@atproto/oauth-client-browser` (PKCE + PAR + DPoP, sessions persisted
in IndexedDB). There are two modes, selected automatically by `import.meta.env.DEV`.

### Development — loopback client

atproto defines a special "loopback" client for local development: the
`client_id` is literally `http://localhost` with the scope and `redirect_uri`
encoded as query params. No hosted metadata file is needed. This is why:

- the dev server is pinned to **127.0.0.1:5173** (`vite.config.ts`), and
- `src/lib/oauth/client.ts` synthesizes the loopback `client_id` and the
  `redirect_uri` (`<origin>/oauth/callback`) from `window.location.origin`.

Just run `npm run dev`, open http://127.0.0.1:5173, and sign in with a handle.

### Production — hosted client metadata

In a production build you must:

1. Host `public/client-metadata.json` at a stable public HTTPS URL.
2. Set the env vars (see `.env.example`):
   - `VITE_CLIENT_ID` — the URL of that `client-metadata.json` (this *is* the
     OAuth `client_id`).
   - `VITE_REDIRECT_URI` — must also be listed in the metadata's
     `redirect_uris` and must match your deployed `/oauth/callback` route.

The requested scope is `atproto transition:generic transition:chat.bsky`; the
chat scope plus the `atproto-proxy` header (see `src/lib/api/proxy.ts`) are
required for DMs.

## Routing & deploy

This is an SPA using `react-router-dom` 7's data router with the history API.
Any host must rewrite unknown paths to `index.html` (history-API fallback) so
deep links like `/profile/alice.bsky.social/post/abc` resolve. Vite's dev server
already does this.

## Architecture (the load-bearing rules)

- **All network access** goes through `useAgent()` / `getAgent()`
  (`src/lib/api/agent.tsx`). Never construct an `Agent` in a feature.
- **All cache keys** come from `qk.*` (`src/lib/query-keys.ts`). Never inline a
  key array. React Query is the sole server-state cache.
- **Optimistic like/repost/bookmark** patch the cached `InfiniteData` via
  `patchPostInAllFeeds` (`src/lib/optimistic.ts`); do **not** invalidate the
  patched feed on settle (avoids scroll jitter).
- **Rich text** renders via `src/lib/rich-text.tsx` segments; never slice raw
  text by byte offsets. Build facets with `buildFacets` before posting.
- **Image upload** only via `src/lib/blob.ts` (`uploadImage`, compresses < 1MB).
- **Preferences** writes only via `src/lib/prefs.ts` (read-modify-write the
  whole array).
- **Theming** via `<html data-theme="light|dim|dark">`; colors are CSS vars in
  `src/styles/tokens.css`. Components read vars only — never hardcode hex. Theme
  is applied pre-paint by an inline script in `index.html` and persisted by the
  ui store.

## Project layout

```
src/
  main.tsx, App.tsx          # root wiring (QueryClient + Auth + Router)
  styles/                    # tokens.css + globals.css
  lib/                       # oauth, agent, query client/keys, rich-text, etc.
  components/                # shared presentational UI (+ layout/ shell)
  features/                  # one folder per product area (route entries)
  routes/                    # router, RootLayout, RequireAuth, NotFound
  store/                     # zustand ui store (ephemeral UI only)
```

Feature folders under `src/features/*` are filled in separately; the router
references their entry files by path.
