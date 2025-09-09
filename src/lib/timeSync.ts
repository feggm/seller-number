import { pb } from '../clients/pocketbase'

let timeDiff = 0 // Server time - client time in milliseconds

export const initializeTimeSync = async (): Promise<void> => {
  try {
    const response = await pb.send<{ now: string }>('/api/seller-number/now', {
      method: 'GET',
    })

    const clientTime = Date.now()
    const serverTime = new Date(response.now).getTime()
    timeDiff = serverTime - clientTime

    console.log(
      `Time sync initialized. Server offset: ${timeDiff.toString()}ms`
    )
  } catch (error) {
    console.error('Failed to initialize time sync:', error)
  }
}

export const getSyncedNow = (): Date => {
  return new Date(Date.now() + timeDiff)
}
