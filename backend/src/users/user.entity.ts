import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entite TypeORM du compte utilisateur (F1 - comptes et profils).
 *
 * Nom de table en pluriel/snake_case ("users") conformement a la convention
 * de nommage du projet (voir CLAUDE.md). Les noms de colonnes suivent la
 * meme regle via l'option `name` de chaque @Column.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Email de connexion, unique. @Index en plus de `unique: true` : garantit
   * un lookup rapide sur l'email (utilise a chaque login), pas seulement
   * la contrainte d'unicite.
   */
  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  /**
   * Hash bcrypt du mot de passe - JAMAIS le mot de passe en clair.
   * Nom de colonne explicite (password_hash) pour qu'il soit evident, meme
   * cote base de donnees, qu'il ne s'agit pas d'un mot de passe brut.
   */
  @Column({ name: 'password_hash' })
  passwordHash: string;

  /**
   * Hash SHA-256 (pas bcrypt) du token de reinitialisation de mot de passe
   * en cours (issue #70), nul si aucune demande active. SHA-256 plutot que
   * bcrypt volontairement : le token est deja un secret aleatoire a haute
   * entropie (voir AuthService.forgotPassword), pas un mot de passe choisi
   * par un humain a proteger contre le brute-force - un hash rapide et
   * deterministe suffit, et permet en plus de retrouver l'utilisateur par
   * un simple `WHERE reset_token_hash = ...` (l'endpoint de confirmation ne
   * recoit que le token, jamais l'email). Un hash bcrypt, sale et non
   * deterministe, rendrait cette recherche impossible sans boucler sur tous
   * les utilisateurs.
   */
  @Column({ name: 'reset_token_hash', nullable: true, type: 'varchar' })
  resetTokenHash: string | null;

  /** Expiration du token ci-dessus - au-dela, meme un hash correct est refuse. */
  @Column({
    name: 'reset_token_expires_at',
    nullable: true,
    type: 'timestamp',
  })
  resetTokenExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
