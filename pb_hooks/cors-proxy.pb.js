routerAdd('GET', '/api/seller-number/cors-proxy', (e) => {
  const cache = require(`${__hooks}/cache.js`)
  const url = e.request.url.query().get('url')

  // Check cache first
  const cachedData = cache.get(url)
  if (cachedData) {
    return e.json(200, cachedData)
  }

  const res = $http.send({
    method: 'GET',
    url,
    headers: e.requestInfo().headers,
  })

  // Cache the response
  cache.set(url, res.json)

  return e.json(200, res.json)
})
