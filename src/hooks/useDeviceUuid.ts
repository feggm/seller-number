import { useLocalStorage } from 'react-use'

export const useDeviceUuid = () => {
  const [deviceUuid] = useLocalStorage('deviceUuid', crypto.randomUUID())
  return deviceUuid ?? ''
}
