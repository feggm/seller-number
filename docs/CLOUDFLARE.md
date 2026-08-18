# Cloudflare ↔ Uberspace: TLS, ACME and page-load latency

> **Status: work in progress.** The root cause is confirmed and fixed for both production
> domains (2026-08-18). What is *not* yet confirmed is why ACME renewal fails while the
> Cloudflare proxy is enabled — see [Open questions](#open-questions). Several other
> Uberspace + Cloudflare sites are available to test the proposed fixes against; that
> validation has not been done yet.

Placeholders used throughout (real values deliberately omitted):

| Placeholder | Meaning |
|---|---|
| `<origin-ip>` | Public IPv4 of the Uberspace host |
| `<uberspace-host>` | Uberspace hostname, i.e. the reverse DNS of `<origin-ip>` (`*.uberspace.de`) |

## The symptom

Page loads were intermittently slow — sometimes ~100 ms, sometimes 3–10 s — with no
pattern anyone could pin down. Which request appeared slow moved around between loads:
sometimes the HTML document, sometimes `/api/seller-number/now`, sometimes `/api/realtime`.

Backend profiling found nothing, because there was nothing to find. Measured locally, the
PocketBase origin sustains ~35,000 rps on `/api/seller-number/now` with a p99 of 1 ms.

## Root cause

**The Uberspace origin had no TLS certificate for our domains.** It served the
`*.uberspace.de` wildcard instead, and TLS handshakes for our SNI took **2.5–3.8 s**.

Everything else was fast. Only the handshake was slow:

| Stage | Time |
|---|---|
| TCP connect | 10 ms |
| **TLS handshake** | **2.5–3.8 s** |
| Application response | 12 ms |
| Plain HTTP on `:80` (no TLS) | 22 ms |

Handshake time depended entirely on the SNI presented:

| SNI | Handshake |
|---|---|
| `reg.kleidermarkt-gummersbach.de` | 3.80 s |
| `reg.anziehbar-gummersbach.de` | 3.47 s |
| `<uberspace-host>` | 0.15 s |
| *(no SNI)* | 0.14 s |

Interleaved probes ruled out warm-up: alternating our domain and `<uberspace-host>` gave
3.08 / 0.15 / 2.72 / 0.14 / 2.55 / 0.15 s.

### Why it looked intermittent

Cloudflare **pools its origin connections**. Only the request that opens a *new* edge→origin
connection pays the handshake; everything reusing a warm connection returns in ~50 ms.

That single fact explains the whole confusing picture:

- Whichever request happened to open the connection was the slow one — hence the blame
  moving between `/`, `/now` and `/api/realtime`.
- Concurrent requests during page load need several connections, so more than one could stall.
- A page load shortly after another was fast; an isolated load was slow.
- In one capture, an unrelated origin request completed in 52 ms *while* `/now` was still
  hanging — proving the server was never busy, one connection was still handshaking.

Cloudflare reports this split directly in a response header on the document:

```
server-timing: cfEdge;dur=7, cfOrigin;dur=3319
```

7 ms at the edge, 3319 ms at the origin. **This header is the fastest possible first check**
and would have pointed at the origin immediately.

### Why it looked like an application problem

`src/main.tsx` awaits `initializeTimeSync()` — a call to `/api/seller-number/now` — *before*
`createRoot().render()`. Nothing paints until that request resolves. In one captured slow
load `onLoad` fired at 182 ms, but the user saw a blank page for 5.5 s because that one
request was the one that opened the cold connection.

The render gate did not *cause* the slowness, but it converted a single stalled request into
a fully blank page. Worth removing independently — see the note at the end.

## Diagnosing it

Run these before touching application code.

**1. Split edge vs origin time** (works from anywhere, no access needed):

```bash
curl -sI -H 'Cache-Control: no-cache' https://<domain>/ | grep -i 'server-timing\|cf-cache-status'
```

A large `cfOrigin;dur=` means the origin is slow. A large `cfEdge;dur=` means it is not.

**2. Check which certificate the origin actually serves:**

```bash
echo | openssl s_client -connect <origin-ip>:443 -servername <domain> 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

A subject of `CN=*.uberspace.de` instead of `CN=<domain>` means **no certificate is
provisioned for this domain** — this is the failure mode.

**3. Time the handshake per SNI**, comparing against the host's own name as a control:

```bash
for sni in <domain> <uberspace-host>; do
  printf "%-40s " "$sni"
  /usr/bin/time -p sh -c "echo | openssl s_client -connect <origin-ip>:443 -servername $sni >/dev/null 2>&1" 2>&1 \
    | awk '/real/{print $2"s"}'
done
```

If our domain is slow and `<uberspace-host>` is fast, it is the missing certificate.

**4. Reproduce the user-visible stall** — parallel requests force new origin connections:

```bash
for i in 1 2 3; do
  curl -s -o /dev/null -w "  /now  %{time_total}s\n" "https://<domain>/api/seller-number/now" &
  curl -s -o /dev/null -w "  /col  %{time_total}s\n" "https://<domain>/api/collections/eventCategories/records?page=1&perPage=1" &
  wait
done
```

Broken: 2.8–6.2 s. Healthy: ~0.07 s.

> Do **not** include `/api/realtime` in this test with a `--max-time` flag. It is a
> long-lived SSE stream; the timeout value will be reported as the duration and looks like a
> stall when nothing is wrong.

## The fix

Uberspace provisions Let's Encrypt certificates itself, but validation fails while the
Cloudflare proxy is enabled. The working procedure is:

1. Set the domain's DNS record to **DNS-only** (grey cloud) in Cloudflare.
2. Request the site once, so Uberspace triggers issuance.
3. Verify the new certificate on the Uberspace host (diagnostic 2 above — subject must be
   `CN=<domain>`, issuer Let's Encrypt).
4. Switch the record back to **Proxied** (orange cloud).

Applied to both production domains on 2026-08-18. Result:

| | Before | After |
|---|---|---|
| Origin TLS handshake | 2.5–3.9 s | **0.11–0.12 s** |
| `/now` via Cloudflare | 3–6 s when cold | **0.07–0.19 s** |
| Document | 3.3 s (`cfOrigin;dur=3319`) | **0.065–0.12 s** |

The parallel reproducer no longer reproduces.

## Certificate renewal — the unresolved part

Certificates issued this way are valid **90 days** (2026-08-18 → 2026-11-16). If automatic
renewal fails while proxied, the origin silently falls back to the `*.uberspace.de` wildcard
and the 3-second handshakes return.

**Check in mid-October, not mid-November** — deliberately ahead of expiry, so there is room to
react:

```bash
echo | openssl s_client -connect <origin-ip>:443 -servername <domain> 2>/dev/null \
  | openssl x509 -noout -subject -dates
```

### What we ruled out

Probing the ACME HTTP-01 path through the Cloudflare proxy showed it is **not** blocked:

- A request to `/.well-known/acme-challenge/<token>` through Cloudflare returns the identical
  nginx 404 as a direct-to-origin request — so it reaches the origin.
- `Always Use HTTPS` is enabled, but Cloudflare has a **built-in exemption** for
  `/.well-known/acme-challenge/` — that path is not redirected to HTTPS.
- No WAF / bot challenge interferes.

### What we found

**Cloudflare caches responses on the ACME challenge path.** Repeating a request to the same
token URL returns `cf-cache-status: HIT` — Cloudflare caches 404s by default (~3 min).

Plausible failure mode: Let's Encrypt fetches the token slightly before the daemon has written
it → 404 → Cloudflare caches the 404 → the daemon writes the token → LE retries the same URL →
served the cached 404 → validation fails. This matches the observed behaviour of an ACME retry
loop that never succeeds while other requests pass through normally.

### Proposed rules (untested — validate before relying on them)

**Caching Rule** (Rules → Caching Rules) — the one that matters:

- Expression: `(http.request.uri.path contains "/.well-known/acme-challenge/")`
- Action: **Bypass cache**

**WAF custom rule** (Security → WAF → Custom rules) — insurance only, nothing is currently
blocking:

- Same expression, action **Skip** → Managed Rules, Rate Limiting, Bot Fight Mode,
  Browser Integrity Check

Verification once applied: the ACME path should report `cf-cache-status: BYPASS` rather
than `HIT`.

## Open questions

1. **Does the cache-bypass rule actually fix renewal while proxied?** Unverified. Needs a real
   renewal cycle, or a forced re-issue, to confirm.
2. **Does Uberspace gate issuance on a DNS pre-check?** Their tooling may require the domain's
   A/AAAA records to resolve to `<origin-ip>`. While proxied, they resolve to Cloudflare
   addresses instead. If issuance is blocked *before* any HTTP challenge, **no Cloudflare rule
   can fix it** and the grey-cloud dance stays mandatory. The ACME daemon log on the Uberspace
   host distinguishes the two: an ownership/DNS pre-check error reads very differently from a
   challenge-fetch 404.
3. **Can a Cloudflare Origin CA certificate be installed on Uberspace?** Cloudflare issues
   these free with a 15-year lifetime, valid only for the edge→origin hop. That would remove
   ACME from the picture permanently. Whether Uberspace's managed TLS permits a custom
   certificate is unconfirmed — worth asking their support.
4. **Is this reproducible across the other Uberspace + Cloudflare sites?** Several are
   available to test against. Confirming the same signature there — wildcard cert served,
   multi-second handshake, fast `<uberspace-host>` control — would establish this as a general
   Uberspace + Cloudflare pattern rather than something specific to this project.

## Fallback options if renewal keeps failing

1. **Cloudflare Origin CA certificate** — eliminates ACME entirely, if Uberspace allows it
   (open question 3).
2. **Automate the grey-cloud cycle** via the Cloudflare API from a cron on the Uberspace host,
   scheduled ahead of expiry. Reliable, but briefly exposes the origin IP.
3. **Manual procedure on a calendar reminder.** It takes a few minutes and is already proven.

## Related

- The render gate in `src/main.tsx` amplifies any single stalled request into a blank page.
  `timeDiff` defaults to `0` and `getSyncedNow()` falls back to local time, so rendering first
  is safe — but `useUpcomingEventQuery` reads `getSyncedNow()` under `staleTime: Infinity`, so
  invalidate that query once sync lands, or race the await against a ~1 s timeout.
- Static asset cache headers are set by `pb_hooks/cache-headers.pb.js`; see
  [`ARCHITECTURE.md`](./ARCHITECTURE.md).
