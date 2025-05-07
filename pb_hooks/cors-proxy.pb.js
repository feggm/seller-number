routerAdd('GET', '/api/seller-number/cors-proxy', (e) => {
  const url = e.request.url.query().get('url')

  const res = $http.send({
    method: 'GET',
    url,
    headers: e.requestInfo().headers,
  })

  return e.json(200, res.json)
})
