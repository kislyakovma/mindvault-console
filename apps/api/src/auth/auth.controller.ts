import { Controller, Post, Get, Body, Req, Res, UseGuards, HttpCode } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt.guard'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  async signup(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: any) {
    const result = await this.auth.signup(body.email, body.password)
    res.cookie('refresh_token', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 })
    return { accessToken: result.accessToken, user: result.user }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: any) {
    const result = await this.auth.login(body.email, body.password)
    res.cookie('refresh_token', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 })
    return { accessToken: result.accessToken, user: result.user }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = req.cookies?.refresh_token
    const result = await this.auth.refresh(token)
    res.cookie('refresh_token', result.refreshToken, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 })
    return { accessToken: result.accessToken }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    await this.auth.logout(req.user.sub)
    res.clearCookie('refresh_token')
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async me(@Req() req: any) {
    return { user: req.user }
  }
}
