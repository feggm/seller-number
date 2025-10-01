import * as Sentry from '@sentry/react'

export const initSentry = () => {
  Sentry.init({
    dsn: 'https://e8ffeb661532e3ca279475245f2a36af@o4510110329470976.ingest.de.sentry.io/4510112658817104',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    integrations: [Sentry.replayIntegration()],
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.,
    // Enable logs to be sent to Sentry
    enableLogs: true,
  })
}
