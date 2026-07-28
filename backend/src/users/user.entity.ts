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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
