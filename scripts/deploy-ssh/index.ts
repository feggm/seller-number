import { z } from 'zod'
import { parser } from 'zod-opts'

import { sellerNumberConfig } from './config/seller-number.ini.ts'
import { ssh } from './ssh.ts'

const cliParser = parser()
  .name('npm deploy:ssh')
  .description(
    'deploy the app to a remote server. Will ssh into the server, fetch the latest changes (via git), install dependencies and restart the app.'
  )
  .options({
    sshHost: {
      type: z.string().default('arche.uberspace.de'),
      alias: 'h',
      description: 'specify the ssh host where to deploy',
    },
    sshUser: {
      type: z.string().default('kkm2'),
      alias: 'u',
      description: 'specify the ssh user',
    },
    remotePath: {
      type: z.string().default('/home/kkm2/projects/seller-number'),
      alias: 'p',
      description: 'specify the remote path where to deploy',
    },
  })

const run = async () => {
  const { sshHost, sshUser, remotePath } = cliParser.parse()

  // ssh into the server
  await ssh.setup({ user: sshUser, host: sshHost, path: remotePath })

  // fetch the latest changes (via git)
  await ssh.run('git pull')

  // stop the app
  await ssh.run('supervisorctl stop seller-number')

  // install dependencies
  await ssh.run('npm install')

  // build the project
  await ssh.run('npm run build')

  // create/update the ini file
  await ssh.run(
    `mkdir -p ~/etc/services.d && echo "${sellerNumberConfig()}" > ~/etc/services.d/seller-number.ini && supervisorctl reread && supervisorctl update`
  )

  // start the app
  await ssh.run('supervisorctl start seller-number')
}

void run()
