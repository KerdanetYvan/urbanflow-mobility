import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtPayload } from './jwt-payload.interface';

/**
 * Variante de JwtAuthGuard qui ne bloque jamais la requete : peuple
 * request.user si un access token valide est fourni, laisse la requete
 * passer sans erreur sinon (pas de 401). A poser sur un endpoint public dont
 * le comportement peut etre personnalise pour un utilisateur connecte, ex.
 * GET /trips (issue #16 - classement pondere selon le profil de mobilite
 * si l'utilisateur est authentifie, recherche anonyme sinon).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Signature volontairement reduite a (err, user) : les parametres
  // info/context de Passport ne sont pas utilises ici (contrairement a err,
  // ignore aussi mais present pour documenter la forme attendue).
  handleRequest<TUser = JwtPayload>(
    _err: unknown,
    user: TUser | false,
  ): TUser | undefined {
    return user || undefined;
  }
}
