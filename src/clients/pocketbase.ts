import PocketBase from 'pocketbase'

import { disablePolling, enablePolling } from './utils/polling'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)

pb.autoCancellation(false)

enablePolling()
pb.realtime.onDisconnect = () => {
  enablePolling()
}
void pb.realtime.subscribe('PB_CONNECT', () => {
  disablePolling()
})
