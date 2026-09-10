import type { Protocol, VpnConfig } from './types'

const countryNames: Record<string, string> = {
  us: 'آمریکا', usa: 'آمریکا', uk: 'بریتانیا', de: 'آلمان', germany: 'آلمان',
  nl: 'هلند', france: 'فرانسه', tr: 'ترکیه', jp: 'ژاپن', ca: 'کانادا',
  sg: 'سنگاپور', ru: 'روسیه', ir: 'ایران',
}

function protocolOf(value: string): Protocol {
  const text = value.toLowerCase()
  if (text.includes('sstp')) return 'MS-SSTP'
  if (text.includes('openvpn') || text.includes('.ovpn') || text.includes('remote ')) return 'OpenVPN'
  return 'Unknown'
}

function locationOf(value: string) {
  const match = value.match(/\b([a-z]{2,3})\b/i)
  return match ? countryNames[match[1].toLowerCase()] || match[1].toUpperCase() : 'نامشخص'
}

export function parseSource(input: string, baseUrl?: string): { configs: VpnConfig[]; warning?: string } {
  const trimmed = input.trim()
  if (!trimmed) return { configs: [], warning: 'منبع خالی بود.' }

  const htmlConfigs = parseVpnGateHtml(trimmed, baseUrl)
  if (htmlConfigs.length) return { configs: htmlConfigs }

  try {
    const parsed = JSON.parse(trimmed)
    const rows = Array.isArray(parsed) ? parsed : parsed.configs || parsed.servers || parsed.data
    if (Array.isArray(rows)) {
      const configs = rows.map((row, index) => {
        const raw = typeof row === 'string' ? row : JSON.stringify(row, null, 2)
        const text = typeof row === 'string' ? row : `${row.protocol || ''} ${row.server || row.host || ''} ${row.country || ''}`
        return makeConfig(raw, text, index)
      })
      return { configs }
    }
  } catch {
    // Plain text/HTML fallback below.
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const configs = lines
    .filter((line) => !line.startsWith('<') && !/^<!doctype/i.test(line))
    .map((line, index) => makeConfig(line, line, index))
    .filter((config) => config.protocol !== 'Unknown' || /(\.ovpn|sstp|remote\s)/i.test(config.raw))

  return configs.length
    ? { configs, warning: 'قالب منبع ناشناخته بود؛ داده‌ها با parser متنی عمومی استخراج شدند.' }
    : { configs: [], warning: 'قالب منبع شناسایی نشد. فقط متن خام OpenVPN یا MS-SSTP قابل نمایش است.' }
}

function parseVpnGateHtml(input: string, baseUrl?: string): VpnConfig[] {
  if (!/<table[^>]+vg_hosts_table_id/i.test(input)) return []
  const rows = [...input.matchAll(/<tr>\s*<td class=['"]vg_table_row_[01][\s\S]*?<\/tr>/gi)]
  const configs: VpnConfig[] = []
  rows.forEach((match, rowIndex) => {
    const raw = match[0]
    const host = raw.match(/([a-z0-9-]+\.opengw\.net)/i)?.[1]
    if (!host) return
    const countryCode = raw.match(/flags\/([a-z]{2})\.png/i)?.[1]?.toLowerCase()
    const location = countryCode ? countryNames[countryCode] || countryCode.toUpperCase() : 'نامشخص'
    const latency = Number(raw.match(/Ping:\s*<b>(\d+)\s*ms/i)?.[1])
    const protocols: Protocol[] = []
    const openVpnHref = raw.match(/href=['"]([^'"]*do_openvpn\.aspx[^'"]*)['"]/i)?.[1]
    const sstpHref = raw.match(/href=['"]([^'"]*howto_sstp\.aspx[^'"]*)['"]/i)?.[1]
    if (openVpnHref) protocols.push('OpenVPN')
    if (sstpHref) protocols.push('MS-SSTP')
    protocols.forEach((protocol, protocolIndex) => {
      configs.push({
        id: `${rowIndex}-${protocolIndex}-${host}`,
        protocol,
        location,
        server: host,
        port: protocol === 'OpenVPN' ? (raw.match(/TCP:\s*(\d{2,5})/i)?.[1] || '—') : '443',
        status: 'unknown',
        latency: Number.isFinite(latency) && latency > 0 ? latency : undefined,
        raw,
        detailUrl: baseUrl ? new URL(protocol === 'OpenVPN' ? openVpnHref! : sstpHref!, baseUrl).toString() : undefined,
      })
    })
  })
  if (configs.length) return configs

  // VPN Gate occasionally serves its activity table at the same URL. It has
  // no downloadable host name, but its protocol rows are still useful and
  // must not be mistaken for a normal host list.
  const activityRows = [...input.matchAll(/<tr>\s*((?:<td\b[^>]*>[\s\S]*?<\/td>\s*){5,})<\/tr>/gi)]
  activityRows.forEach((match, index) => {
    const row = match[1]
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[1]))
    const protocol = cells.find((cell): cell is Protocol => cell === 'OpenVPN' || cell === 'MS-SSTP')
    if (!protocol) return
    const server = cells[4] || 'سرور نامشخص'
    const location = cells[3] || cells[2] || 'نامشخص'
    configs.push({ id: `activity-${index}-${protocol}`, protocol, location, server, port: '—', status: 'unknown', raw: match[0] })
  })
  return configs
}

function stripHtml(value: string) {
  return value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

function makeConfig(raw: string, context: string, index: number): VpnConfig {
  const protocol = protocolOf(context)
  const host = context.match(/(?:remote|server|host|address)[\s:=]+([a-z0-9.-]+)/i)?.[1] || context.match(/\b([a-z0-9-]+\.[a-z]{2,})\b/i)?.[1] || 'سرور ناشناس'
  const port = context.match(/(?:remote\s+\S+\s+|port[\s:=]+)(\d{2,5})/i)?.[1] || '—'
  return {
    id: `${index}-${host}-${protocol}`,
    protocol,
    location: locationOf(context),
    server: host,
    port,
    status: 'unknown',
    raw,
  }
}
