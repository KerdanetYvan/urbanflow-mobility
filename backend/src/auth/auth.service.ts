import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { IsNull, LessThan, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload, RefreshTokenPayload } from './jwt-payload.interface';
import { RefreshToken } from './refresh-token.entity';

/** Paire de jetons renvoyee au client apres une authentification reussie. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Meme sel bcrypt que UsersService.create - coherence du cout de hachage sur tout mot de passe stocke. */
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Fenetre de grace (issue #268) : un refresh token deja consomme, re-presente
 * dans ce delai, est tolere (une nouvelle paire est emise dans la meme
 * famille SANS rien revoquer) plutot que traite comme un rejeu. Couvre les
 * rafraichissements quasi simultanes - plusieurs onglets partageant le meme
 * refresh token en localStorage tombent en 401 en meme temps - sans ouvrir
 * de vraie fenetre de reutilisation exploitable (15 s, cote client un
 * single-flight limite deja le cas, voir frontend/src/lib/api.ts).
 */
const REFRESH_REUSE_GRACE_MS = 15_000;

/** Repli si le refresh token signe n'expose pas de claim `exp` decodable (ne devrait pas arriver - `expiresIn` est toujours fourni). */
const REFRESH_FALLBACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
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

    // Nouvelle connexion = nouvelle famille de session (issue #268).
    const { tokens } = await this.issueTokenPair(
      { sub: user.id, email: user.email },
      randomUUID(),
    );
    return tokens;
  }

  /**
   * Echange un refresh token valide contre une nouvelle paire de jetons, avec
   * ROTATION stricte (issue #268, A07 OWASP) :
   *
   * 1. Verifie la signature/expiration du JWT (JWT_REFRESH_SECRET, pas
   *    JWT_SECRET : un access token expire ne peut pas servir de refresh
   *    token).
   * 2. Confronte le `jti` a la table `refresh_tokens` :
   *    - inconnu / famille revoquee => rejet ;
   *    - deja consomme AU-DELA de la fenetre de grace => REJEU : revocation
   *      de toute la famille (deconnexion forcee de la session), rejet ;
   *    - deja consomme DANS la fenetre de grace => rafraichissements quasi
   *      simultanes, on emet une nouvelle paire sans rien revoquer ;
   *    - valide et non consomme => on le marque consomme et on emet le
   *      suivant dans la meme famille.
   *
   * Le message d'erreur est volontairement identique dans tous les cas de
   * rejet (pas d'indice sur la raison exacte a un attaquant).
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let claims: RefreshTokenPayload;
    try {
      claims = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          // Meme restriction explicite que JwtStrategy (audit securite
          // OWASP #262, API8) - defense en profondeur.
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    // Refresh token emis avant l'introduction de la rotation (#268) : aucun
    // `jti`. On le refuse pour forcer une reconnexion propre - la fenetre est
    // bornee par l'expiration du refresh (7 j).
    if (!claims.jti || !claims.fam) {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    const stored = await this.refreshTokensRepository.findOne({
      where: { id: claims.jti },
    });

    // `jti` absent de la table (purge, ou jeton forge malgre une signature
    // valide - improbable) : par prudence on brule la famille annoncee si
    // elle existe, puis on rejette.
    if (
      !stored ||
      stored.familyId !== claims.fam ||
      stored.userId !== claims.sub
    ) {
      await this.revokeFamily(claims.fam);
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    if (stored.revokedAt) {
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    const alreadyConsumed = stored.consumedAt !== null;
    if (alreadyConsumed) {
      const consumedSinceMs = Date.now() - stored.consumedAt!.getTime();
      if (consumedSinceMs > REFRESH_REUSE_GRACE_MS) {
        // Rejeu avere d'un jeton deja consomme : signal de vol. On revoque
        // toute la famille - la session legitime ET l'attaquant sont
        // deconnectes, l'utilisateur devra se reconnecter.
        await this.revokeFamily(stored.familyId);
        this.logger.warn(
          `Rejeu de refresh token detecte (famille ${stored.familyId}, utilisateur ${stored.userId}) - session revoquee`,
        );
        throw new UnauthorizedException('Refresh token invalide ou expire');
      }
      // Dans la fenetre de grace : rafraichissements concurrents, on laisse
      // passer sans revoquer ni re-consommer `stored`.
    }

    // L'utilisateur existe-t-il toujours (pas supprime depuis l'emission) ?
    const user = await this.usersService.findById(stored.userId);
    if (!user) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Refresh token invalide ou expire');
    }

    const issued = await this.issueTokenPair(
      { sub: user.id, email: user.email },
      stored.familyId,
    );

    // Marque le jeton courant consomme (sauf s'il l'etait deja - cas fenetre
    // de grace) et le relie a son remplacant (chaine d'audit).
    if (!alreadyConsumed) {
      await this.refreshTokensRepository.update(stored.id, {
        consumedAt: new Date(),
        replacedBy: issued.jti,
      });
    }

    return issued.tokens;
  }

  /**
   * Marque comme revoquees toutes les lignes encore actives d'une famille de
   * session. Idempotent (le `WHERE revoked_at IS NULL` evite d'ecraser une
   * date de revocation anterieure). Aucun effet si la famille est inconnue.
   */
  private async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokensRepository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Purge quotidienne des refresh tokens expires (leur JWT est de toute
   * facon deja rejete par la verification de signature/expiration - ces
   * lignes ne servent plus a rien). Meme approche que
   * TripHistoryService#handleDailyPurge. Necessite ScheduleModule.forRoot()
   * (enregistre globalement dans AppModule).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpiredRefreshTokens(): Promise<void> {
    const result = await this.refreshTokensRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    if (result.affected && result.affected > 0) {
      this.logger.log(`Purge de ${result.affected} refresh token(s) expire(s)`);
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

  /**
   * Emet une paire access + refresh et enregistre le refresh token dans la
   * table `refresh_tokens` (issue #268).
   *
   * L'access token reste `{ sub, email }`. Le refresh token porte en plus
   * `jti` (son identifiant unique, genere ici) et `fam` (la famille de
   * session passee par l'appelant : nouvelle a `login()`, reprise a chaque
   * rotation dans `refresh()`).
   *
   * @param payload identite de l'utilisateur (`sub` = id, `email`)
   * @param familyId identifiant de la famille de session
   * @returns la paire de jetons et le `jti` du refresh emis (pour renseigner
   *   `replaced_by` sur le jeton precedent lors d'une rotation)
   */
  private async issueTokenPair(
    payload: JwtPayload,
    familyId: string,
  ): Promise<{ tokens: TokenPair; jti: string }> {
    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      ...payload,
      jti,
      fam: familyId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_EXPIRATION',
          '15m',
        ) as StringValue,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION',
          '7d',
        ) as StringValue,
      }),
    ]);

    // `expires_at` recopie depuis le claim `exp` du refresh token qu'on vient
    // de signer, pour que la ligne en base et le JWT expirent exactement au
    // meme instant (et pouvoir purger sans redecoder chaque jeton).
    const decoded = this.jwtService.decode<{ exp?: number } | null>(
      refreshToken,
    );
    const expiresAt =
      decoded && typeof decoded.exp === 'number'
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + REFRESH_FALLBACK_TTL_MS);

    await this.refreshTokensRepository.save(
      this.refreshTokensRepository.create({
        id: jti,
        familyId,
        userId: payload.sub,
        expiresAt,
        consumedAt: null,
        revokedAt: null,
        replacedBy: null,
      }),
    );

    return { tokens: { accessToken, refreshToken }, jti };
  }
}
