import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

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

    // Check role-based access
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles: string[] = [];
      if (decoded.isAdmin) userRoles.push('admin');
      if (decoded.isSuperAdmin) userRoles.push('super_admin');
      userRoles.push('collab'); // everyone is at least a collab

      const hasRole = requiredRoles.some(r => userRoles.includes(r));
      if (!hasRole) throw new ForbiddenException('Accès réservé aux administrateurs');
    }

    return true;
  }
}
