import { createWriteStream } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import yauzl from 'yauzl-promise'

import { type OSString } from './getOS.ts'

const fileUrl = new URL(import.meta.url)
const __dirname = fileUrl.pathname

export const downloadPocketbase = async ({
  version,
  os,
  filename,
}: {
  version: string
  os: OSString
  filename: string
}) => {
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${version}/pocketbase_${version}_${os}.zip`

  console.log(`Downloading PocketBase from ${url}...`)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download PocketBase: ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Save zip to a temporary file
  const tempZipPath = path.resolve(__dirname, '../../..', 'temp-pocketbase.zip')
  await fs.writeFile(tempZipPath, buffer)

  console.log(`Extracting PocketBase...`)

  // Extract using yauzl
  try {
    const targetPath = path.resolve(__dirname, '../../..', filename)
    const zipFile = await yauzl.open(tempZipPath)

    for await (const entry of zipFile) {
      if (entry.filename === 'pocketbase') {
        console.log(`Found PocketBase executable, extracting to ${targetPath}`)
        const readStream = await entry.openReadStream()
        const writeStream = createWriteStream(targetPath)

        await new Promise<void>((resolve, reject) => {
          readStream.pipe(writeStream).on('finish', resolve).on('error', reject)
        })

        // Make it executable (Unix systems only)
        if (!os.includes('windows')) {
          await fs.chmod(targetPath, 0o755)
        }

        console.log(`PocketBase executable available at ${targetPath}`)
        break
      }
    }

    // Clean up the temporary zip file
    await fs.unlink(tempZipPath)

    return targetPath
  } catch (error) {
    console.error('Error extracting zip:', error)
    throw error
  }
}
