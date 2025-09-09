import { getSyncedNow } from '@/lib/timeSync'
import { useCallback, useSyncExternalStore } from 'react'

const simpleCurrentDateStore = {
  intervalId: null as NodeJS.Timeout | null,
  currentDate: getSyncedNow(),
  subscribers: new Set<() => void>(),
  addSubscriber(callback: () => void) {
    this.subscribers.add(callback)
    this.start()
    return () => {
      this.subscribers.delete(callback)
      if (this.subscribers.size === 0) {
        this.stop()
      }
    }
  },
  notifySubscribers() {
    this.subscribers.forEach((callback) => {
      callback()
    })
  },
  start() {
    if (this.intervalId) return
    this.intervalId = setInterval(() => {
      this.currentDate = getSyncedNow()
      this.notifySubscribers()
    }, 1000)
  },
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  },
}

export const useCurrentTime = () => {
  const nowDate = useSyncExternalStore(
    (cb) => simpleCurrentDateStore.addSubscriber(cb),
    () => simpleCurrentDateStore.currentDate
  )
  const getTimeDiff = useCallback(
    (date: Date) => {
      const diff = date.getTime() - nowDate.getTime()
      return {
        seconds: Math.floor(diff / 1000),
        minutes: Math.floor(diff / (1000 * 60)),
        hours: Math.floor(diff / (1000 * 60 * 60)),
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      }
    },
    [nowDate]
  )
  return {
    nowDate,
    getTimeDiff,
    seconds: nowDate.getSeconds(),
    minutes: nowDate.getMinutes(),
    hours: nowDate.getHours(),
    day: nowDate.getDate(),
    month: nowDate.getMonth() + 1, // Months are zero-indexed
    year: nowDate.getFullYear(),
  }
}
