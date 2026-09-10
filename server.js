import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const port = Number(process.env.PORT || 8787)
const defaultSource = 'http://150.40.105.10:46711/en/'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.get('/api/config', (_req, res) => {
  res.json({
    sourceUrl: process.env.SOURCE_URL || defaultSource,
    healthUrl: process.env.HEALTH_URL || '',
  })
})

function parseHttpUrl(value) {
  const target = new URL(value)
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP(S) sources are supported')
  return target
}

async function fetchText(target) {
  const response = await fetch(target, {
    headers: { 'User-Agent': 'VPN-Finder/1.0 (+local proxy)' },
    signal: AbortSignal.timeout(12000),
  })
  return { response, body: await response.text() }
}

app.get('/api/source', async (req, res) => {
  let target
  try {
    target = parseHttpUrl(String(req.query.url || process.env.SOURCE_URL || defaultSource))
  } catch {
    return res.status(400).json({ error: 'آدرس منبع معتبر نیست.' })
  }

  try {
    const { response, body } = await fetchText(target)
    res.status(response.ok ? 200 : 502).type(response.headers.get('content-type') || 'text/plain').send(body)
  } catch (error) {
    res.status(502).json({ error: `دریافت منبع ناموفق بود: ${error instanceof Error ? error.message : 'خطای ناشناخته'}` })
  }
})

app.get('/api/detail', async (req, res) => {
  try {
    const target = parseHttpUrl(String(req.query.url || ''))
    const { response, body } = await fetchText(target)
    res.status(response.ok ? 200 : 502).type(response.headers.get('content-type') || 'text/html').send(body)
  } catch (error) {
    res.status(502).json({ error: `صفحه جزئیات دریافت نشد: ${error instanceof Error ? error.message : 'خطای ناشناخته'}` })
  }
})

app.get('/api/download', async (req, res) => {
  try {
    const detailUrl = parseHttpUrl(String(req.query.detail || ''))
    const detail = await fetchText(detailUrl)
    if (!detail.response.ok) throw new Error('صفحه جزئیات در دسترس نیست')
    const match = detail.body.match(/href=['"]([^'"]*openvpn_download\.aspx[^'"]*)['"]/i)
    if (!match) throw new Error('لینک فایل واقعی OpenVPN در صفحه جزئیات پیدا نشد')
    const fileUrl = new URL(match[1].replace(/&amp;/g, '&'), detailUrl)
    const file = await fetch(fileUrl, { headers: { 'User-Agent': 'VPN-Finder/1.0 (+local proxy)' }, signal: AbortSignal.timeout(12000) })
    if (!file.ok) throw new Error(`دریافت فایل واقعی ناموفق بود (${file.status})`)
    const data = Buffer.from(await file.arrayBuffer())
    const server = String(req.query.server || 'vpn-config').replace(/[^a-z0-9._-]/gi, '_')
    res.status(200).type('application/x-openvpn-profile').set('Content-Disposition', `attachment; filename="${server}.ovpn"`).send(data)
  } catch (error) {
    res.status(502).json({ error: `دانلود فایل واقعی ممکن نشد: ${error instanceof Error ? error.message : 'خطای ناشناخته'}` })
  }
})

app.get('/api/health', async (req, res) => {
  const healthUrl = String(req.query.url || process.env.HEALTH_URL || '')
  if (!healthUrl) return res.json({ status: 'unknown', message: 'آدرس بررسی سلامت تنظیم نشده است.' })
  try {
    const started = Date.now()
    const response = await fetch(healthUrl, { method: 'HEAD', signal: AbortSignal.timeout(7000) })
    res.json({ status: response.ok ? 'online' : 'offline', latency: Date.now() - started })
  } catch {
    res.json({ status: 'offline', message: 'بررسی endpoint سلامت ناموفق بود.' })
  }
})

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
  app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))
}

app.listen(port, () => console.log(`VPN Finder proxy listening on http://localhost:${port}`))
