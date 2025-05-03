export type OSString =
  | 'darwin_amd64'
  | 'darwin_arm64'
  | 'linux_amd64'
  | 'linux_arm64'
  | 'linux_armv7'
  | 'linux_ppc64le'
  | 'linux_s390x'
  | 'windows_amd64'
  | 'windows_arm64'

export const getOS = (): OSString => {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin') {
    if (arch === 'x64') return 'darwin_amd64'
    if (arch === 'arm64') return 'darwin_arm64'
  }

  if (platform === 'linux') {
    if (arch === 'x64') return 'linux_amd64'
    if (arch === 'arm64') return 'linux_arm64'
    if (arch === 'arm') return 'linux_armv7'
    if (arch === 'ppc64') return 'linux_ppc64le'
    if (arch === 's390x') return 'linux_s390x'
  }

  if (platform === 'win32') {
    if (arch === 'x64') return 'windows_amd64'
    if (arch === 'arm64') return 'windows_arm64'
  }

  throw new Error(`Unsupported platform: ${String(platform)} ${String(arch)}`)
}
