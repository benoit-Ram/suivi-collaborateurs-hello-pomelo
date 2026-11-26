import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Rate limit dédié au login : 10 requêtes / minute / IP (vs 100 pour le reste).
  // Protège contre brute-force sur des tokens Google forgés.
  @Throttle({ login: { ttl: 60_000, limit: 10 } })
  @Public()
  @Post('login')
  async login(@Body() body: { credential: string }) {
    return this.authService.login(body.credential);
  }
}
