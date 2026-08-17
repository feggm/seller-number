// PocketBase serves the built frontend from pb_public/ without any Cache-Control
// header of its own, which leaves the caching policy to whatever sits in front of
// it (Cloudflare defaults to a 1 day browser TTL). That is wrong for index.html:
// it is the only file Vite does not content-hash, so a cached copy pins the
// browser to the previous build's chunk names — the old app keeps running out of
// the browser cache until the TTL expires, even after a deploy.
//
// So: /assets/* is content-hashed and safe to cache forever, everything else
// static has to be revalidated on every load.
routerUse((e) => {
  const path = e.request.url.path

  // Leave the API and the admin UI alone — PocketBase sets its own headers there,
  // and /api/realtime is a long-lived SSE stream.
  if (!path.startsWith('/api/') && !path.startsWith('/_/')) {
    e.response
      .header()
      .set(
        'Cache-Control',
        path.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache'
      )
  }

  return e.next()
})
