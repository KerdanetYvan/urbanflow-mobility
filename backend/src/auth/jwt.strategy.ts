import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './jwt-payload.interface';

/**
 * Strategie Passport qui valide les ACCESS tokens (jamais les refresh
 * tokens, qui ne transitent que par POST /auth/refresh, verifies
 * manuellement dans AuthService avec leur propre secret).
 *
 * Utilisee par JwtAuthGuard pour proteger les futurs endpoints necessitant
 * une authentification (ex. F1 - profil de mobilite, prochaine issue).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  /**
   * Appele automatiquement par Passport une fois la signature/expiration du
   * token verifiees. La valeur retournee devient `request.user` dans les
   * controleurs proteges par JwtAuthGuard.
   *
   * Verifie en plus que l'utilisateur existe encore en base (issue #164) :
   * un access token reste signe/valide jusqu'a son expiration naturelle
   * (15 min par defaut) meme apres suppression du compte (DELETE /users/me)
   * puisque les JWT sont sans etat par construction (aucune liste de
   * revocation dans ce projet, voir lib/auth.ts#logout cote frontend, deja
   * documente comme "purement local"). Ce lookup DB supplementaire a chaque
   * requete authentifiee est le compromis retenu plutot qu'introduire une
   * liste de revocation : garantit qu'un compte supprime perd l'acces aux
   * endpoints proteges immediatement, pas seulement a l'expiration du token.
   */
  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Compte introuvable');
    }
    return payload;
  }
}
