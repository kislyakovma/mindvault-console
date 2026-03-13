import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { execSync } from 'child_process'
import * as fs from 'fs'

// VPN peer limit per plan (только для пользователей с купленным ассистентом)
export const VPN_LIMITS: Record<string, number> = {
  PLUS: 2,
  PRO:  5,
  MAX:  10,
}

const SERVER_PUBLIC_KEY = (() => {
  try { return fs.readFileSync('/etc/wireguard/server_public.key', 'utf8').trim() }
  catch { return 'SERVER_PUBLIC_KEY_NOT_CONFIGURED' }
})()

const WG_INTERFACE = 'wg0'
const VPN_SUBNET = '10.8.0'
const SERVER_ENDPOINT = 'vpn.mvault.ru:51820'

@Injectable()
export class VpnService {
  constructor(private prisma: PrismaService) {}

  async listCerts(userId: string) {
    const certs = await this.prisma.vpnCert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, createdAt: true, revokedAt: true, publicKey: true },
    })

    const { limit, plan } = await this.getUserVpnLimit(userId)
    const active = certs.filter(c => c.status === 'ACTIVE').length

    return { certs, limit, active, plan }
  }

  async issueCert(userId: string, name: string) {
    const { limit, plan } = await this.getUserVpnLimit(userId)

    if (!plan || limit === 0) {
      throw new ForbiddenException(
        'VPN доступен только при наличии активной подписки на ассистента.'
      )
    }

    const active = await this.prisma.vpnCert.count({
      where: { userId, status: 'ACTIVE' },
    })

    if (active >= limit) {
      throw new ForbiddenException(
        `Достигнут лимит VPN-сертификатов для плана ${plan} (${limit} шт.). Обновите подписку.`
      )
    }

    // Генерируем реальные WireGuard ключи
    const privateKey = execSync('wg genkey').toString().trim()
    const publicKey  = execSync(`echo '${privateKey}' | wg pubkey`).toString().trim()
    const presharedKey = execSync('wg genpsk').toString().trim()

    // Назначаем IP из пула 10.8.0.x (начиная с .2, .1 — сервер)
    const peerIp = await this.allocatePeerIp()

    const cert = await this.prisma.vpnCert.create({
      data: { userId, name, privateKey, publicKey, presharedKey, peerIp },
    })

    // Добавляем peer в WireGuard немедленно
    await this.addWgPeer(publicKey, presharedKey, peerIp)

    return {
      id: cert.id,
      name: cert.name,
      status: cert.status,
      createdAt: cert.createdAt,
      config: this.buildConfig(privateKey, presharedKey, peerIp),
    }
  }

  async revokeCert(userId: string, certId: string) {
    const cert = await this.prisma.vpnCert.findFirst({ where: { id: certId, userId } })
    if (!cert) throw new NotFoundException()

    // Удаляем peer из WireGuard
    try {
      execSync(`wg set ${WG_INTERFACE} peer ${cert.publicKey} remove`, { stdio: 'pipe' })
    } catch { /* peer мог быть уже удалён */ }

    await this.prisma.vpnCert.update({
      where: { id: certId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
    return { ok: true }
  }

  async getCertConfig(userId: string, certId: string) {
    const cert = await this.prisma.vpnCert.findFirst({ where: { id: certId, userId } })
    if (!cert || cert.status === 'REVOKED') throw new NotFoundException('Not found or revoked')
    return { config: this.buildConfig(cert.privateKey, cert.presharedKey, cert.peerIp || '10.8.0.2') }
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private buildConfig(privateKey: string, presharedKey: string, peerIp: string): string {
    return [
      `[Interface]`,
      `PrivateKey = ${privateKey}`,
      `Address = ${peerIp}/32`,
      `DNS = 1.1.1.1`,
      ``,
      `[Peer]`,
      `PublicKey = ${SERVER_PUBLIC_KEY}`,
      `PresharedKey = ${presharedKey}`,
      `Endpoint = ${SERVER_ENDPOINT}`,
      `AllowedIPs = 0.0.0.0/0`,
      `PersistentKeepalive = 25`,
    ].join('\n')
  }

  private async addWgPeer(publicKey: string, presharedKey: string, ip: string) {
    try {
      execSync(
        `wg set ${WG_INTERFACE} peer ${publicKey} preshared-key <(echo '${presharedKey}') allowed-ips ${ip}/32`,
        { shell: '/bin/bash', stdio: 'pipe' }
      )
      // Сохраняем конфиг
      execSync(`wg-quick save ${WG_INTERFACE}`, { stdio: 'pipe' })
    } catch (e: any) {
      // Не критично если wg недоступен в dev
      console.warn('WireGuard peer add failed (non-fatal):', e.message)
    }
  }

  private async allocatePeerIp(): Promise<string> {
    // Берём все занятые IP и выдаём следующий свободный
    const used = await this.prisma.vpnCert.findMany({
      where: { status: 'ACTIVE', peerIp: { not: null } },
      select: { peerIp: true },
    })
    const usedNums = new Set(used.map(c => parseInt(c.peerIp?.split('.')[3] || '0')))
    for (let i = 2; i <= 254; i++) {
      if (!usedNums.has(i)) return `${VPN_SUBNET}.${i}`
    }
    throw new Error('VPN IP pool exhausted')
  }

  private async getUserVpnLimit(userId: string): Promise<{ limit: number; plan: string | null }> {
    const sub = await this.prisma.assistantSubscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { plan: true },
    })
    if (!sub) return { limit: 0, plan: null }
    return { limit: VPN_LIMITS[sub.plan] ?? 0, plan: sub.plan }
  }
}
