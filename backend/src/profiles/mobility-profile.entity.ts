import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEncryptedColumnTransformer } from '../common/encryption/encrypted-column.transformer';
import { User } from '../users/user.entity';
import { AccessibilityPreference } from './accessibility-preference.enum';
import { TransportMode } from './transport-mode.enum';

/**
 * Profil de mobilite d'un utilisateur (F1) : preferences de transport et
 * contraintes d'accessibilite, utilisees plus tard par le service de
 * scoring (partie 7.3 du dossier) pour ponderer les itineraires proposes.
 *
 * Relation one-to-one avec User : chaque utilisateur a au plus un profil.
 * `user_id` unique fait a la fois office de cle etrangere et de contrainte
 * d'unicite (pas deux profils pour le meme utilisateur).
 */
@Entity('mobility_profiles')
export class MobilityProfile {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'user_id', unique: true })
  userId: string;

  // Pas de @ApiProperty : relation interne, jamais serialisee dans une
  // reponse (elle porterait passwordHash) - voir ProfilesService, qui ne
  // charge jamais cette relation.
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Tableau de modes de transport preferes (voir TransportMode). Type
   * Postgres natif "text[]" via TypeORM plutot qu'une table de jointure
   * separee : simple, suffisant pour une liste de preferences courte et
   * sans metadonnee propre.
   */
  @ApiProperty({ enum: TransportMode, isArray: true })
  @Column({
    name: 'preferred_transport_modes',
    type: 'text',
    array: true,
    default: '{}',
  })
  preferredTransportModes: TransportMode[];

  /**
   * Preferences d'accessibilite (contrainte C10 du sujet, issue #68) : voir
   * AccessibilityPreference. Tableau Postgres natif "text[]", meme pattern
   * que preferredTransportModes - une preference "cochee" = presente dans
   * le tableau. Volontairement pas de seuil numerique (un "max" elimine des
   * trajets au lieu de les classer) ni de champ libre (inexploitable par
   * une formule de scoring) : chaque valeur est concue pour devenir une
   * entree de ponderation du futur service de scoring (partie 7.3 du
   * dossier), a l'exception possible de wheelchair_accessible dont le
   * cablage reel (parametre wheelchair d'OpenTripPlanner en dur vs poids de
   * scoring) reste a trancher lors de l'integration OTP correspondante.
   */
  @ApiProperty({ enum: AccessibilityPreference, isArray: true })
  @Column({
    name: 'accessibility_preferences',
    type: 'text',
    array: true,
    default: '{}',
  })
  accessibilityPreferences: AccessibilityPreference[];

  /**
   * Adresse domicile/travail (issue #113), utilisees comme raccourcis
   * d'origine sur l'ecran de recherche (issue #93). Chiffrees au repos
   * (RGPD, meme transformer que TripHistoryEntry - issue #22/#11, voir
   * docs/specs/rgpd-geolocalisation.md section 2.2) : une adresse
   * domicile/travail est une donnee de geolocalisation aussi sensible qu'un
   * trajet historise. Contrairement a l'historique, pas de purge temporelle
   * (section 3.2 de la meme spec) - donnee de profil durable, effacee
   * uniquement par une mise a jour explicite ou la suppression du compte
   * (CASCADE, deja en place via la relation `user` ci-dessus).
   *
   * Chaque paire lat/lon est complete ou totalement absente (jamais une
   * moitie seule, inexploitable comme origine de recherche) - verifie par
   * ProfilesService, pas par ce decorateur (une contrainte inter-champs ne
   * se modelise pas avec class-validator sur un champ isole).
   */
  @ApiPropertyOptional({ example: 'Domicile' })
  @Column({
    name: 'home_label',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<string>(),
  })
  homeLabel: string | null;

  @ApiPropertyOptional({ example: 48.111 })
  @Column({
    name: 'home_lat',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<number>(),
  })
  homeLat: number | null;

  @ApiPropertyOptional({ example: -1.682 })
  @Column({
    name: 'home_lon',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<number>(),
  })
  homeLon: number | null;

  @ApiPropertyOptional({ example: 'Travail' })
  @Column({
    name: 'work_label',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<string>(),
  })
  workLabel: string | null;

  @ApiPropertyOptional({ example: 48.127 })
  @Column({
    name: 'work_lat',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<number>(),
  })
  workLat: number | null;

  @ApiPropertyOptional({ example: -1.682 })
  @Column({
    name: 'work_lon',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<number>(),
  })
  workLon: number | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
