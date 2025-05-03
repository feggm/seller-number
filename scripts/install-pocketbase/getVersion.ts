import { readFile } from 'fs/promises'
import { join } from 'path'

const fileUrl = new URL(import.meta.url)
const __dirname = fileUrl.pathname

export const getVersion = async () => {
  const pbVersionPath = join(__dirname, '../../../', '.pbversion')
  return (await readFile(pbVersionPath, { encoding: 'utf8' })).trim()
}
