export const sellerNumberConfig = () =>
  `[program:seller-number]
directory=%(ENV_HOME)s/projects/seller-number
command=%(ENV_HOME)s/projects/seller-number/pocketbase.bin serve --http :8090
autostart=yes
autorestart=yes
startsecs=60
`
