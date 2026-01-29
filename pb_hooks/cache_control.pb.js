// Prevent caching of API responses to avoid serving stale data
routerUse((e) => {
  e.response.header().set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  e.response.header().set('Pragma', 'no-cache')
  e.response.header().set('Expires', '0')
})
