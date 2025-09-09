routerAdd('GET', '/api/seller-number/now', (e) => {
  try {
    const now = new Date().toISOString()
    return e.json(200, { now })
  } catch (error) {
    console.error(error)
    $app.logger().error('Error in time endpoint', 'error', error)
    return e.json(500, {
      error: 'Internal server error',
    })
  }
})
