import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
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
  constructor(configService: ConfigService) {
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
   */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
