import { ConflictException, Injectable } from '@nestjs/common';
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
}
