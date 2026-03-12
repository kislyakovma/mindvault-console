import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { randomBytes } from 'crypto'

// Stub: real WireGuard key generation will be added in provisioning phase
@Injectable()
export class VpnService {
  constructor(private prisma: PrismaService) {}

  async listCerts(userId: string) {
    return this.prisma.vpnCert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, status: true, createdAt: true, revokedAt: true },
    })
  }

  async issueCert(userId: string, name: string) {
    const privateKey = randomBytes(32).toString('base64')
    const publicKey = randomBytes(32).toString('base64')
    const presharedKey = randomBytes(32).toString('base64')

    const cert = await this.prisma.vpnCert.create({
      data: { userId, name, privateKey, publicKey, presharedKey },
    })

    return {
      id: cert.id,
      name: cert.name,
      status: cert.status,
      createdAt: cert.createdAt,
    }
  }

  async revokeCert(userId: string, certId: string) {
    await this.prisma.vpnCert.updateMany({
      where: { id: certId, userId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
    return { ok: true }
  }

  async getCertConfig(userId: string, certId: string) {
    const cert = await this.prisma.vpnCert.findFirst({ where: { id: certId, userId } })
    if (!cert || cert.status === 'REVOKED') throw new Error('Not found or revoked')

    // Stub config — реальные данные сервера подставятся при провижнинге
    const config = [
      `[Interface]`,
      `PrivateKey = ${cert.privateKey}`,
      `Address = 10.0.0.2/32`,
      `DNS = 1.1.1.1`,
      ``,
      `[Peer]`,
      `PublicKey = SERVER_PUBLIC_KEY`,
      `PresharedKey = ${cert.presharedKey}`,
      `Endpoint = vpn.mvault.ru:51820`,
      `AllowedIPs = 0.0.0.0/0`,
      `PersistentKeepalive = 25`,
    ].join('\n')

    return { config }
  }
}
