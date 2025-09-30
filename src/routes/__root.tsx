import { useDynamicFaviconAndTitle } from '@/hooks/useDynamicFaviconAndTitle'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

function RootComponent() {
  useDynamicFaviconAndTitle()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Outlet />
      <TanStackRouterDevtools />
    </div>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
