import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Un refresh token emis, trace en base pour permettre la ROTATION stricte au
 * sens OWASP (issue #268, A07 - voir docs/audits/owasp-audit.md section 4).
 *
 * Le refresh token reste un JWT signe (verification de signature/expiration
 * sans acces base), mais son `jti` est desormais aussi confronte a cette
 * table a chaque `POST /auth/refresh` :
 *
 * - un `jti` inconnu / revoque / consomme hors fenetre de grace => rejet, et
 *   si c'est un rejeu d'un jeton deja consomme, revocation de TOUTE la
 *   famille (`family_id`) : signal de vol, on deconnecte la session entiere ;
 * - un `jti` valide et non consomme => on le marque `consumed_at`, on emet le
 *   suivant dans la meme famille, `replaced_by` pointe vers lui (chaine
 *   d'audit).
 *
 * Une "famille" = une session : creee a `login()`, prolongee a chaque
 * rotation, brulee d'un coup a la moindre reutilisation suspecte.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  /**
   * Identifiant unique du refresh token = claim `jti` du JWT correspondant.
   * Fourni par AuthService (randomUUID) a l'emission, pas auto-genere par la
   * base : il doit etre connu AVANT la signature du JWT pour y etre embarque.
   */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * Identifiant de la famille de jetons (= la session). Tous les jetons
   * issus d'un meme `login()` puis de ses rotations successives le
   * partagent. Indexe : la revocation de rejeu fait un `UPDATE ... WHERE
   * family_id = ?`.
   */
  @Index()
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Relation interne, jamais serialisee (meme motif que les autres entites
  // du projet) - sert uniquement au `ON DELETE CASCADE` : supprimer un
  // compte purge ses refresh tokens.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Expiration du JWT (claim `exp`), recopiee en clair ici pour permettre la
   * purge periodique des lignes perimees sans avoir a decoder chaque jeton.
   */
  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  /** Date de premiere utilisation (rotation). `null` = jamais utilise. */
  @Column({ name: 'consumed_at', type: 'timestamp', nullable: true })
  consumedAt: Date | null;

  /**
   * Date de revocation. Renseignee pour TOUTES les lignes d'une famille des
   * qu'un rejeu est detecte sur l'une d'elles. `null` = encore valide.
   */
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  /** `jti` du refresh token emis en remplacement lors de la rotation (chaine d'audit). */
  @Column({ name: 'replaced_by', type: 'uuid', nullable: true })
  replacedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
