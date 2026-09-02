import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { MoreThan, QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './user.entity';

/**
 * Nombre de "rounds" de sel bcrypt. 10 est la valeur par defaut recommandee
 * par la doc bcrypt : bon compromis entre securite et temps de calcul
 * (chaque round supplementaire double le cout, donc le temps de connexion).
 */
const BCRYPT_SALT_ROUNDS = 10;

/** Code d'erreur Postgres pour une violation de contrainte unique. */
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Cree un nouvel utilisateur avec mot de passe hache (jamais en clair).
   *
   * Double protection contre les emails en doublon :
   * 1. Verification prealable (findByEmail) : chemin rapide, message clair.
   * 2. Rattrapage de la contrainte unique en base (voir le catch) : au cas
   *    ou deux inscriptions arriveraient en meme temps entre l'etape 1 et
   *    l'ecriture reelle (condition de course peu probable mais possible).
   *    Sans ce filet, l'erreur remonterait comme une 500 opaque via
   *    AllExceptionsFilter plutot qu'une 409 explicite.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Cet email est deja utilise');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = this.usersRepository.create({
        email: dto.email,
        passwordHash,
      });
      return await this.usersRepository.save(user);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as unknown as { code?: string }).code ===
          POSTGRES_UNIQUE_VIOLATION
      ) {
        throw new ConflictException('Cet email est deja utilise');
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  /**
   * Enregistre un token de reinitialisation de mot de passe (deja hache en
   * SHA-256 par AuthService, jamais en clair) et son expiration. Ecrase une
   * demande precedente non utilisee s'il y en avait une : une seule
   * demande active a la fois par utilisateur.
   */
  async setResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
    });
  }

  /**
   * Retrouve l'utilisateur associe a un hash de token de reinitialisation,
   * seulement s'il n'a pas expire. Utilise par la confirmation
   * (POST /auth/reset-password), qui ne recoit que le token - jamais l'email.
   */
  findByValidResetToken(tokenHash: string): Promise<User | null> {
    return this.usersRepository.findOneBy({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: MoreThan(new Date()),
    });
  }

  /**
   * Applique le nouveau mot de passe (deja hache en bcrypt par AuthService)
   * et invalide le token de reinitialisation dans la meme ecriture - usage
   * unique, un lien de reinitialisation ne peut pas servir deux fois.
   */
  async resetPassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.usersRepository.update(userId, {
      passwordHash: newPasswordHash,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });
  }

  /**
   * Supprime definitivement le compte de l'utilisateur (issue #164, droit a
   * l'effacement - RGPD article 17). Exige le mot de passe en clair pour
   * confirmer l'action (voir DeleteAccountDto) : nature destructive et
   * irreversible, on ne se repose pas uniquement sur la possession d'un
   * access token (qui peut fuiter/etre partage) pour une action de cette
   * gravite - meme logique de defense en profondeur qu'un changement de mot
   * de passe critique.
   *
   * La suppression de la ligne `users` entraine, par cascade
   * (`onDelete: 'CASCADE'` sur chaque relation - voir MobilityProfile,
   * TripHistoryEntry, FollowedTrip, PushSubscription), la suppression de
   * toutes les donnees liees dans la meme transaction geree par Postgres :
   * pas besoin de les supprimer une a une ici.
   *
   * Ne verifie PAS explicitement que `userId` existe avant de chercher
   * l'utilisateur : si JwtStrategy.validate() a laisse passer la requete,
   * c'est que l'utilisateur existait encore a cet instant (verification
   * ajoutee par cette meme issue, voir jwt.strategy.ts) - le `if (!user)`
   * ci-dessous n'est qu'un filet de securite en cas d'appel direct au
   * service (tests, ou future evolution qui contournerait le guard).
   *
   * ForbiddenException (403), PAS UnauthorizedException (401), pour un mot
   * de passe de confirmation incorrect - distinction volontaire et
   * importante cote frontend : `authRequest` (lib/api.ts) interprete TOUT
   * 401 comme "access token expire", tente automatiquement un
   * rafraichissement puis rejoue la requete UNE fois avant, en cas de
   * nouvel echec, d'effacer les jetons stockes et d'annoncer "Session
   * expiree". Un mot de passe errone n'a rien a voir avec la validite du
   * jeton : le signaler en 401 ferait perdre a tort sa session a un
   * utilisateur authentifie qui s'est simplement trompe de mot de passe
   * (jetons effaces, message d'erreur incorrect affiche). 403 n'entre pas
   * dans ce mecanisme de retry, propage tel quel le message "Mot de passe
   * incorrect" (voir AccountActions#confirmDelete cote frontend).
   */
  async remove(userId: string, password: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) {
      throw new ForbiddenException();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new ForbiddenException('Mot de passe incorrect');
    }

    await this.usersRepository.remove(user);
  }
}
