routerAdd('POST', '/api/seller-number/reservation', (e) => {
  const { sellerNumberVariationId } = e.request.body.json()
})
