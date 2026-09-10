export type Protocol = 'OpenVPN' | 'MS-SSTP' | 'Unknown'
export type HealthStatus = 'healthy' | 'checking' | 'unknown' | 'offline'

export interface VpnConfig {
  id: string
  protocol: Protocol
  location: string
  server: string
  port: string
  status: HealthStatus
  latency?: number
  raw: string
  detailUrl?: string
}
