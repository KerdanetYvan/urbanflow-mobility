import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * Tableau de modes de transport preferes (voir TransportMode). Type
   * Postgres natif "text[]" via TypeORM plutot qu'une table de jointure
   * separee : simple, suffisant pour une liste de preferences courte et
   * sans metadonnee propre.
   */
  @Column({
    name: 'preferred_transport_modes',
    type: 'text',
    array: true,
    default: '{}',
  })
  preferredTransportModes: TransportMode[];

  /**
   * Accessibilite PMR (contrainte C10 du sujet) : correspond au parametre
   * de routage "accessible en fauteuil roulant" d'OpenTripPlanner, base sur
   * le champ GTFS wheelchair_boarding et les tags OSM - une contrainte
   * reellement exploitable par le graphe de routage, contrairement a un
   * evitement des escaliers au cas par cas (pas de donnee de ce niveau de
   * detail dans le GTFS/OSM utilises par le projet).
   */
  @Column({ name: 'reduced_mobility', default: false })
  reducedMobility: boolean;

  /** Distance de marche maximale acceptee, en metres. Optionnel. */
  @Column({ name: 'max_walking_distance_meters', type: 'int', nullable: true })
  maxWalkingDistanceMeters: number | null;

  /** Nombre de correspondances maximum accepte sur un trajet. Optionnel. */
  @Column({ name: 'max_transfers', type: 'int', nullable: true })
  maxTransfers: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
