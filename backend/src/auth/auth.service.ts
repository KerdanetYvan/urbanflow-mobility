import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { StringValue } from 'ms';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './jwt-payload.interface';

/** Paire de jetons renvoyee au client apres une authentification reussie. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Meme sel bcrypt que UsersService.create - coherence du cout de hachage sur tout mot de passe stocke. */
const BCRYPT_SALT_ROUNDS = 10;

/** Message renvoye par POST /auth/forgot-password, que l'email existe ou non (pas d'enumeration). */
const FORGOT_PASSWORD_MESSAGE =
  'Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.';

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          // Meme restriction explicite que JwtStrategy (audit securite
          // OWASP #262, API8) - defense en profondeur.
          algorithms: ['HS256'],
        },
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

  /**
   * Demande de reinitialisation de mot de passe. Reponse volontairement
   * identique que l'email existe ou non (meme raisonnement que login() :
   * ne jamais reveler quels emails sont inscrits, OWASP).
   *
   * L'envoi d'email n'est jamais attendu (fire-and-forget, erreur seulement
   * loggee) : d'une part pour que le SMTP indisponible ne fasse pas
   * echouer la requete cote client, d'autre part pour que la latence de la
   * reponse ne varie pas selon que l'utilisateur existe (un `await` ici
   * ferait clairement ressortir le cas "email existant" au chronometre).
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(dto.email);

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashResetToken(rawToken);
      const expirationMinutes = Number(
        this.configService.get<string>('RESET_TOKEN_EXPIRATION_MINUTES', '60'),
      );
      const expiresAt = new Date(Date.now() + expirationMinutes * 60_000);

      await this.usersService.setResetToken(user.id, tokenHash, expiresAt);

      const frontendUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'http://localhost:5173',
      );
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      this.mailService
        .sendPasswordResetEmail(user.email, resetUrl)
        .catch((error: unknown) => {
          this.logger.error(
            `Echec d'envoi de l'email de reinitialisation pour ${user.email}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  /**
   * Confirmation de reinitialisation : verifie le token (hash + expiration,
   * usage unique) puis applique le nouveau mot de passe.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = this.hashResetToken(dto.token);
    const user = await this.usersService.findByValidResetToken(tokenHash);

    if (!user) {
      throw new BadRequestException(
        'Lien de reinitialisation invalide ou expire',
      );
    }

    const newPasswordHash = await bcrypt.hash(
      dto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );
    await this.usersService.resetPassword(user.id, newPasswordHash);

    return { message: 'Mot de passe reinitialise.' };
  }

  /**
   * SHA-256, pas bcrypt : le token est deja un secret aleatoire a haute
   * entropie (32 octets), pas un mot de passe choisi par un humain a
   * proteger contre le brute-force - un hash rapide et deterministe
   * suffit, et permet en plus de retrouver l'utilisateur par un simple
   * `WHERE reset_token_hash = ...` (voir UsersService.findByValidResetToken).
   * Un hash bcrypt, sale et non deterministe, rendrait cette recherche
   * impossible sans boucler sur tous les utilisateurs.
   */
  private hashResetToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
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
