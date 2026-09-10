import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Check, ChevronDown, Copy, Download, ExternalLink, FileDown, Globe2, HardDriveDownload, Info, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { parseSource } from './parser'
import type { HealthStatus, Protocol, VpnConfig } from './types'

const fallbackSource = 'http://150.40.105.10:46711/en/'
type SortMode = 'default' | 'latency' | 'country'

function App() {
  const [sourceUrl, setSourceUrl] = useState(fallbackSource)
  const [configs, setConfigs] = useState<VpnConfig[]>([])
  const [query, setQuery] = useState('')
  const [protocol, setProtocol] = useState<'all' | Protocol>('all')
  const [sort, setSort] = useState<SortMode>('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copied, setCopied] = useState('')
  const [actionError, setActionError] = useState('')

  const loadConfigs = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/source?url=${encodeURIComponent(sourceUrl)}`)
      const body = await response.text()
      if (!response.ok) throw new Error(safeError(body))
      const parsed = parseSource(body, sourceUrl)
      setConfigs(parsed.configs); setWarning(parsed.warning || ''); setLastUpdated(new Date())
    } catch (cause) {
      setConfigs([])
      setError(cause instanceof Error ? cause.message : 'دریافت داده ناموفق بود.')
    } finally { setLoading(false) }
  }, [sourceUrl])

  useEffect(() => {
    fetch('/api/config').then((res) => res.json()).then((data) => {
      if (data.sourceUrl) setSourceUrl(data.sourceUrl)
    }).catch(() => undefined)
  }, [])
  useEffect(() => { loadConfigs() }, [loadConfigs])

  const visibleConfigs = useMemo(() => {
    const normalized = query.toLowerCase()
    return configs.filter((item) => {
      const matchesProtocol = protocol === 'all' || item.protocol === protocol
      const matchesQuery = !normalized || `${item.server} ${item.location} ${item.protocol}`.toLowerCase().includes(normalized)
      return matchesProtocol && matchesQuery
    }).sort((a, b) => sort === 'latency' ? (a.latency || 99999) - (b.latency || 99999) : sort === 'country' ? a.location.localeCompare(b.location) : 0)
  }, [configs, protocol, query, sort])

  const copy = async (item: VpnConfig) => {
    await navigator.clipboard.writeText(item.raw)
    setCopied(item.id); setTimeout(() => setCopied(''), 1600)
  }
  const openDetail = async (item: VpnConfig) => {
    if (!item.detailUrl) return
    setActionError('')
    try {
      const url = `/api/detail?url=${encodeURIComponent(item.detailUrl)}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(safeError(await response.text()))
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'صفحه جزئیات در دسترس نیست.')
    }
  }
  const download = async (item: VpnConfig) => {
    if (item.protocol !== 'OpenVPN' || !item.detailUrl) return
    setActionError('')
    try {
      const url = `/api/download?detail=${encodeURIComponent(item.detailUrl)}&server=${encodeURIComponent(item.server)}`
      const response = await fetch(url)
      if (!response.ok) throw new Error(safeError(await response.text()))
      const blobUrl = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${item.server.replace(/[^a-z0-9._-]/gi, '_')}.ovpn`
      link.click()
      URL.revokeObjectURL(blobUrl)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'دانلود فایل واقعی ممکن نشد.')
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">V</span><span>کانفیگ‌یار</span></a>
      <nav><a href="#configs">کانفیگ‌ها</a><a href="#about">درباره پروژه</a></nav>
      <button className="button button-dark settings-button" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17} /> تنظیمات</button>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span className="live-dot" /> پایش منابع عمومی</div><h1>کانفیگ سالم،<br /><em>اتصال شفاف.</em></h1><p>محل ساده و امن برای پیدا کردن کانفیگ‌های OpenVPN و MS-SSTP. بدون اتصال خودکار، بدون حدس و گمان.</p><div className="hero-actions"><a href="#configs" className="button button-yellow">مشاهده کانفیگ‌ها <ChevronDown size={18} /></a><span className="hero-note"><ShieldCheck size={16} /> بررسی دستی و قابل اعتماد</span></div></div>
        <div className="hero-art"><div className="globe-card"><Globe2 size={170} strokeWidth={1.2} /><span className="orbit orbit-one" /><span className="orbit orbit-two" /><div className="art-label">SAFE<br />FINDER</div></div><div className="sticker">NO<br />AUTO<br />CONNECT</div></div>
      </section>

      <section id="configs" className="workspace">
        <div className="section-heading"><div><div className="eyebrow">کتابخانهٔ امروز</div><h2>کانفیگ‌های در دسترس <span className="count-badge">{configs.length}</span></h2></div><div className="updated">{lastUpdated ? `آخرین بروزرسانی ${lastUpdated.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}` : 'در حال دریافت'} <button className="icon-button" onClick={loadConfigs} title="تازه‌سازی"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button></div></div>
        {settingsOpen && <div className="settings-panel"><label>آدرس منبع قابل تغییر<input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label><button className="button button-dark" onClick={() => { setSettingsOpen(false); loadConfigs() }}>ذخیره و دریافت</button><small>پروکسی محلی backend برای عبور از محدودیت CORS استفاده می‌شود.</small></div>}
        {warning && <div className="notice notice-warning"><AlertTriangle size={20} /><span>{warning}</span><button onClick={() => setWarning('')}><X size={17} /></button></div>}
        {error && <div className="notice notice-error"><AlertTriangle size={20} /><span>{error}</span><button onClick={loadConfigs} className="button button-small">تلاش دوباره</button></div>}
        {actionError && <div className="notice notice-error"><AlertTriangle size={20} /><span>{actionError}</span><button onClick={() => setActionError('')}><X size={17} /></button></div>}
        <div className="toolbar"><div className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی سرور، کشور یا پروتکل..." /></div><div className="filters"><SlidersHorizontal size={18} /><select value={protocol} onChange={(event) => setProtocol(event.target.value as typeof protocol)}><option value="all">همه پروتکل‌ها</option><option value="OpenVPN">OpenVPN</option><option value="MS-SSTP">MS-SSTP</option><option value="Unknown">نامشخص</option></select><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="default">مرتب‌سازی: پیش‌فرض</option><option value="latency">کمترین latency</option><option value="country">کشور</option></select></div></div>
        {loading ? <div className="state-card"><RefreshCw className="spin" size={28} /><h3>در حال اسکن منبع...</h3><p>چند لحظه برای دریافت داده‌های تازه صبر کنید.</p></div> : visibleConfigs.length === 0 ? <div className="state-card"><FileDown size={32} /><h3>{error ? 'منبع قابل دسترسی نیست' : 'چیزی پیدا نشد'}</h3><p>{error ? 'اتصال پروکسی را بررسی کنید یا آدرس منبع دیگری وارد کنید.' : 'فیلتر یا عبارت جست‌وجو را تغییر دهید.'}</p></div> : <div className="config-grid">{visibleConfigs.map((item, index) => <ConfigCard key={item.id} item={item} index={index} onCopy={copy} onDownload={download} onOpenDetail={openDetail} copied={copied === item.id} />)}</div>}
      </section>

      <section id="about" className="about"><div className="about-icon"><Info size={30} /></div><div><div className="eyebrow">چرا کانفیگ‌یار؟</div><h2>ابزار کوچک، تصمیم آگاهانه</h2><p>این پروژه فقط داده‌های عمومی را جمع‌آوری و قابل خواندن می‌کند. هیچ اتصال خودکار یا دور زدن محدودیتی انجام نمی‌شود؛ سلامت هر کانفیگ به‌صورت شفاف و با endpoint قابل تنظیم بررسی می‌شود.</p></div><div className="creator">ساخته شده با دقت<br /><strong>By AngelSolo</strong></div></section>
    </main>
    <footer><span>© ۲۰۲۶ کانفیگ‌یار</span><span>منبع فعلی: {sourceHostname(sourceUrl)}</span><span><ExternalLink size={14} /> استفاده مسئولانه</span></footer>
  </div>
}

function ConfigCard({ item, index, onCopy, onDownload, onOpenDetail, copied }: { item: VpnConfig; index: number; onCopy: (item: VpnConfig) => void; onDownload: (item: VpnConfig) => void; onOpenDetail: (item: VpnConfig) => void; copied: boolean }) {
  const statusText: Record<HealthStatus, string> = { healthy: 'سالم', checking: 'در حال بررسی', unknown: 'بررسی نشده', offline: 'آفلاین' }
  return <article className="config-card"><div className="card-top"><span className="card-number">۰{index + 1}</span><button className={`protocol-tag protocol-link ${item.protocol === 'MS-SSTP' ? 'sstp' : ''}`} onClick={() => onOpenDetail(item)} disabled={!item.detailUrl}>{item.protocol}</button><button className="more-button"><ChevronDown size={17} /></button></div><div className="server-icon"><Activity size={24} /></div><h3>{item.server}</h3><div className="meta-row"><span><Globe2 size={15} /> {item.location}</span><span>پورت {item.port}</span></div><div className="status-row"><span className={`status ${item.status}`}><span className="status-dot" /> {statusText[item.status]}</span>{item.latency ? <span className="latency">{item.latency}ms</span> : <span className="latency muted">—</span>}</div><div className="card-actions"><button className="button button-dark" onClick={() => onCopy(item)}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'کپی شد' : 'کپی خام'}</button>{item.protocol === 'OpenVPN' && item.detailUrl ? <button className="button button-light" onClick={() => onDownload(item)}><Download size={16} /> دانلود .ovpn</button> : item.detailUrl ? <button className="button button-light" onClick={() => onOpenDetail(item)}><ExternalLink size={16} /> راهنمای SSTP</button> : <span className="unavailable">دانلود واقعی موجود نیست</span>}</div></article>
}

function safeError(body: string) {
  try { return JSON.parse(body).error || 'پاسخ نامعتبر از منبع دریافت شد.' } catch { return 'پاسخ نامعتبر از منبع دریافت شد.' }
}

function sourceHostname(value: string) {
  try { return new URL(value).hostname } catch { return 'آدرس نامعتبر' }
}

export default App
