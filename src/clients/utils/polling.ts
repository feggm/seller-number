import mitt from 'mitt'

const POLLING_INTERVAL = 5000

let pollingIntervalId: number | undefined

const emitter = mitt<{ poll: unknown }>()

export const enablePolling = () => {
  if (pollingIntervalId) return
  pollingIntervalId = window.setInterval(() => {
    emitter.emit('poll')
  }, POLLING_INTERVAL)
}

export const triggerPoll = ({ force = false } = {}) => {
  if (!force && !pollingIntervalId) return
  emitter.emit('poll')
}

export const disablePolling = () => {
  if (!pollingIntervalId) return
  window.clearInterval(pollingIntervalId)
  pollingIntervalId = undefined
}

export const onPoll = (callback: () => void) => {
  emitter.on('poll', callback)
}
