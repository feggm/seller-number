export const sellerNumberConfig = () =>
  `[program:seller-number]
directory=%(ENV_HOME)s/projects/seller-number
command=%(ENV_HOME)s/projects/seller-number/pocketbase.bin serve --http :8090
stdout_logfile=%(ENV_HOME)s/logs/seller-number.log
stderr_logfile=%(ENV_HOME)s/logs/seller-number.err.log
redirect_stderr=false
autostart=yes
autorestart=yes
startsecs=60
`
