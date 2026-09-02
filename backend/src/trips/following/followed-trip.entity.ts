import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { createEncryptedColumnTransformer } from '../../common/encryption/encrypted-column.transformer';
import { TransportMode } from '../../profiles/transport-mode.enum';
import { User } from '../../users/user.entity';

/** Un segment tel que conserve pour la detection de perturbation (issue #18) - uniquement ce qui sert a recouper avec GtfsRealtimeCacheService#findDisruptions, pas le trace/les couleurs/noms d'affichage (deja connus du frontend, inutiles cote backend pour cette fonctionnalite). */
export interface FollowedTripSegment {
  mode: string;
  routeId?: string;
  tripId?: string;
}

/**
 * Le trajet actuellement suivi par un utilisateur (issue #18) - au plus un
 * par utilisateur (voir docs/specs/f3-scoring-perturbations-suivi.md
 * section 2, "un seul trajet suivi a la fois... demarrer un nouveau suivi
 * remplace silencieusement le precedent") : relation `OneToOne` avec
 * `User`, meme pattern que `MobilityProfile` (un seul profil par
 * utilisateur, upsert plutot que creation multiple).
 *
 * Contrat RGPD (section 6 de la meme spec, meme mecanisme que
 * TripHistoryEntry - issue #22) : coordonnees et libelles chiffres au repos
 * (createEncryptedColumnTransformer), `onDelete: CASCADE` sur `User`.
 * `endTime` NON chiffre (necessaire pour filtrer/purger directement en SQL,
 * voir FollowedTripService#purgeExpired - meme raisonnement que
 * TripHistoryEntry#searchedAt) : une date de fin de trajet seule, sans
 * coordonnees associees, n'est pas une donnee de geolocalisation sensible.
 * `lastNotifiedDisruptionSignature` non chiffre non plus (simple
 * concatenation kind+routeId+tripId+stopId+headerText, pas une donnee
 * personnelle).
 */
@Entity('followed_trips')
export class FollowedTrip {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'user_id', unique: true })
  userId: string;

  // Pas de @ApiProperty : relation interne, jamais serialisee (meme motif
  // que MobilityProfile.user) - le controleur ne charge jamais cette
  // relation.
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ example: 48.11 })
  @Column({
    name: 'origin_lat',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  originLat: number;

  @ApiProperty({ example: -1.68 })
  @Column({
    name: 'origin_lon',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  originLon: number;

  @ApiPropertyOptional({ example: 'République' })
  @Column({
    name: 'origin_label',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<string>(),
  })
  originLabel: string | null;

  @ApiProperty({ example: 48.12 })
  @Column({
    name: 'destination_lat',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  destinationLat: number;

  @ApiProperty({ example: -1.67 })
  @Column({
    name: 'destination_lon',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  destinationLon: number;

  @ApiPropertyOptional({ example: 'Gare' })
  @Column({
    name: 'destination_label',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<string>(),
  })
  destinationLabel: string | null;

  /**
   * Segments de l'itineraire suivi, reduits a {mode, routeId?, tripId?}
   * (voir FollowedTripSegment) - le JSON entier est chiffre (transformer
   * generique, voir createEncryptedColumnTransformer<T>()), pas de colonne
   * dediee par segment (nombre variable, pas de requete SQL necessaire
   * dessus - lu integralement puis filtre en memoire par
   * TripDisruptionMonitorService).
   */
  @ApiProperty({
    description:
      'mode/routeId/tripId de chaque segment - pas le trace complet.',
  })
  @Column({
    name: 'segments',
    type: 'text',
    transformer: createEncryptedColumnTransformer<FollowedTripSegment[]>(),
  })
  segments: FollowedTripSegment[];

  /**
   * Modes de transport demandes lors de la recherche d'origine (issue #87),
   * conserves pour que le recalcul (TripDisruptionMonitorService, meme
   * appel que TripsService#search) reste fidele a la recherche initiale.
   * Tableau Postgres natif "text[]", meme pattern que
   * MobilityProfile#preferredTransportModes - pas de donnee sensible, pas
   * chiffre.
   */
  @ApiPropertyOptional({ enum: TransportMode, isArray: true })
  @Column({
    name: 'transport_modes',
    type: 'text',
    array: true,
    nullable: true,
  })
  transportModes: TransportMode[] | null;

  @ApiProperty()
  @Column({ name: 'end_time', type: 'timestamp' })
  endTime: Date;

  /**
   * Signature de la derniere perturbation notifiee pour ce suivi (anti-spam,
   * docs/specs/f3-scoring-perturbations-suivi.md section 4) - concatenation
   * de RealtimeDisruption (kind+routeId+tripId+stopId+headerText). `null`
   * tant qu'aucune notification n'a encore ete envoyee pour ce suivi.
   */
  @ApiPropertyOptional()
  @Column({
    name: 'last_notified_disruption_signature',
    type: 'text',
    nullable: true,
  })
  lastNotifiedDisruptionSignature: string | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
