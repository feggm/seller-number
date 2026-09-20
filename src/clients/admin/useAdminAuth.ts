import { useMutation } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { pb } from '../pocketbase'
import { withErrorLogging } from '../withErrorLogging'

/**
 * Superuser session for the Verwaltung. The register collections are superuser-only on all
 * five rules, so the page speaks to them with the SDK directly once `_superusers` auth is in
 * the store — PocketBase's own persisted authStore, nothing of our own.
 */
const subscribe = (onChange: () => void) => pb.authStore.onChange(onChange)

const getSnapshot = () =>
  pb.authStore.isValid && pb.authStore.isSuperuser
    ? (pb.authStore.record?.email as string | undefined) ?? 'superuser'
    : null

export const useAdminAuth = () => {
  const superuserEmail = useSyncExternalStore(subscribe, getSnapshot)

  const login = useMutation({
    mutationFn: withErrorLogging(async function adminLoginMutation(credentials: {
      email: string
      password: string
    }) {
      await pb
        .collection('_superusers')
        .authWithPassword(credentials.email, credentials.password)
    }),
  })

  const logout = () => { pb.authStore.clear(); }

  return { superuserEmail, isSuperuser: superuserEmail !== null, login, logout }
}
