import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Toaster } from './components/ui/sonner'
import { EventCategoryIdProvider } from './context/EventCategoryIdContext'
import './index.css'
import { queryClient } from './lib/queryClient'
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

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
