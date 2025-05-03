import { z } from 'zod'
import { parser } from 'zod-opts'

import { downloadPocketbase } from './downloadPocketbase.ts'
import { OSSchema, getOS } from './getOS.ts'
import { getVersion } from './getVersion.ts'

const cliParser = parser()
  .name('pnpm install:pocketbase')
  .options({
    filename: {
      type: z.string().default('pocketbase.bin'),
      alias: 'f',
      description: 'specify where to save the PocketBase binary',
    },
    os: {
      type: OSSchema.optional(),
      description:
        'specify for which operating system (defaults to current running OS)',
    },
    version: {
      type: z.string().optional(),
      description:
        'specify the version of PocketBase to download (e.g. "0.26.4", will default to content of the file .pbversion)',
    },
  })

const run = async () => {
  const {
    filename,
    os = getOS(),
    version = await getVersion(),
  } = cliParser.parse()
  await downloadPocketbase({ version, os, filename })
}

void run()
