import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => (target: any, propertyKey?: string, descriptor?: any) => {
  if (descriptor) {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, descriptor.value);
  } else {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, target);
  }
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token d\'authentification requis');
    }

    const token = authHeader.split(' ')[1];
    const decoded = this.authService.verifyToken(token);

    // Attach user info to request
    request.user = decoded;
    return true;
  }
}
