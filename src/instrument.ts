import * as Sentry from '@sentry/react'

// A DSN is a public client key (safe to ship in the bundle); the env var lets
// other environments override it.
const DSN =
  import.meta.env.VITE_SENTRY_DSN ||
  'https://212625806358892fbcaff7565efb0588@o4504837950930944.ingest.us.sentry.io/4511547088306176'

Sentry.init({
  dsn: DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  // Attaches user context (IP, etc.) to events. Ovoid handles private DMs — flip
  // to false if you'd rather not send any PII.
  sendDefaultPii: true,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Mask everything in session replays: this app renders private messages.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  tracesSampleRate: 1.0,
  // No first-party backend — only propagate trace headers on localhost, never to
  // the third-party AppView / PDS / chat hosts (avoids cross-origin header noise).
  tracePropagationTargets: ['localhost'],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
})
