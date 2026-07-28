import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { StringValue } from 'ms';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt-payload.interface';

/** Paire de jetons renvoyee au client apres une authentification reussie. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Service d'authentification : verification des identifiants, emission et
 * renouvellement des JWT (access + refresh, voir CLAUDE.md - partie 3.10
 * du dossier de certification).
 *
 * Access token : duree de vie courte (JWT_EXPIRATION, 15 min par defaut) -
 * utilise pour chaque requete authentifiee.
 * Refresh token : duree de vie longue (JWT_REFRESH_EXPIRATION, 7 jours) -
 * sert uniquement a obtenir un nouvel access token sans redemander le mot
 * de passe. Signe avec un secret DIFFERENT (JWT_REFRESH_SECRET) : si
 * JWT_SECRET fuite, un attardeur ne peut pas forger de refresh token, et
 * inversement.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Verifie l'email et le mot de passe fournis. Message d'erreur volontairement
   * identique que ce soit l'email qui n'existe pas ou le mot de passe qui
   * soit faux : ne jamais reveler laquelle des deux informations est
   * incorrecte (empeche de deviner quels emails sont inscrits - OWASP,
   * enumeration d'utilisateurs).
   */
  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.usersService.findByEmail(dto.email);
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    return this.issueTokenPair({ sub: user.id, email: user.email });
  }

  /**
   * Echange un refresh token valide contre une nouvelle paire de jetons.
   * Verifie avec JWT_REFRESH_SECRET (pas JWT_SECRET) : un access token
   * expire ne peut pas etre reutilise ici pour se faire passer pour un
   * refresh token.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
      );

      // On s'assure que l'utilisateur existe toujours (pas supprime depuis
      // l'emission du refresh token) avant de renouveler les jetons.
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Utilisateur introuvable');
      }

      return this.issueTokenPair({ sub: user.id, email: user.email });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }
  }

  private async issueTokenPair(payload: JwtPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRATION',
          '15m',
        ) as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION',
          '7d',
        ) as StringValue,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
