import { downloadPocketbase } from './downloadPocketbase.ts'
import { getOS } from './getOS.ts'
import { getVersion } from './getVersion.ts'

const run = async () => {
  const version = await getVersion()
  const os = getOS()
  await downloadPocketbase({ version, os, filename: 'pocketbase.bin' })
}

void run()
