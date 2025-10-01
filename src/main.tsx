import { QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Toaster } from './components/ui/sonner'
import { EventCategoryIdProvider } from './context/EventCategoryIdContext'
import './index.css'
import { queryClient } from './lib/queryClient'
import { initializeTimeSync } from './lib/timeSync'
import { routeTree } from './routeTree.gen'
import { initSentry } from './sentry'

initSentry()

const hashHistory = createHashHistory()

// Create a new router instance
const router = createRouter({ routeTree, history: hashHistory })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: typeof router
  }
}

// Initialize time synchronization
async function initializeApp() {
  await initializeTimeSync()

  // Render the app
  const rootEl = document.getElementById('root')
  if (!rootEl) {
    throw new Error('#root element not found')
  }
  createRoot(rootEl).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <EventCategoryIdProvider>
          <RouterProvider router={router} />
        </EventCategoryIdProvider>
      </QueryClientProvider>
      <Toaster />
    </StrictMode>
  )
}

initializeApp().catch(console.error)
