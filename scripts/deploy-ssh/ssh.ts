import { $ } from 'zx'

import packageJson from '../../package.json' with { type: 'json' }

class Ssh {
  user = ''
  host = ''
  path = ''

  async setup({
    user,
    host,
    path,
  }: {
    user: string
    host: string
    path: string
  }) {
    this.user = user
    this.host = host
    this.path = path

    // Create path in the ssh host if it doesn't exist
    await $`ssh ${this.user}@${this.host} 'mkdir -p ${this.path}'`

    // Check if the path is a git repository
    const isGitRepo = (
      await $`ssh ${this.user}@${this.host} 'if [ -d "${this.path}/.git" ]; then echo "true"; else echo "false"; fi'`
    ).stdout
      .trim()
      .includes('true')

    // If not, clone the repository
    if (!isGitRepo) {
      await $`ssh ${this.user}@${this.host} 'cd ${this.path} && git clone ${packageJson.repository} .'`
    }
  }

  async run(command: string) {
    if (!this.user || !this.host)
      throw new Error('.setup must be called before .run')
    const cdCommand = this.path ? `cd "${this.path}" && ` : ''
    const fullCommand = `${cdCommand}${command}`
    console.log(`Executing: ssh ${this.user}@${this.host} '${fullCommand}'`)
    return await $`ssh ${this.user}@${this.host} ${fullCommand}`
  }
}

export const ssh = new Ssh()
