import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from './jwt-payload.interface';

/**
 * Recupere l'utilisateur authentifie (le payload du JWT d'acces) depuis la
 * requete. Ne fonctionne que sur une route protegee par JwtAuthGuard, qui
 * est ce qui peuple `request.user` (voir JwtStrategy.validate).
 *
 * Usage : `findMine(@CurrentUser() user: JwtPayload) { ... user.sub ... }`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
