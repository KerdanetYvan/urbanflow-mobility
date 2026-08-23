import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { createEncryptedColumnTransformer } from '../../common/encryption/encrypted-column.transformer';
import { User } from '../../users/user.entity';

/**
 * Une entree d'historique de recherche d'itineraire (F2, issue #11) : une
 * ligne par recherche effectuee par un utilisateur authentifie (voir
 * TripsService#search, qui appelle TripHistoryService#record des qu'un
 * userId est disponible). Alimente GET /trips/history et, plus tard, les
 * raccourcis de recherche rapide de l'issue #112.
 *
 * Toutes les coordonnees et tous les libelles d'adresse sont chiffres au
 * repos via createEncryptedColumnTransformer (RGPD, issue #22, voir
 * docs/specs/rgpd-geolocalisation.md section 2.2) - checklist section 4 de
 * ce meme document appliquee ici : colonnes en "text" + transformer, cle
 * GEOLOCATION_ENCRYPTION_KEY, retention 12 mois glissants (voir
 * TripHistoryService), et onDelete: 'CASCADE' sur la relation User.
 *
 * Ecriture volontairement en append-only (jamais de mise a jour d'une ligne
 * existante) : le transformer chiffre genere un IV aleatoire a chaque
 * ecriture (section 2.1 de la spec), donc deux recherches identiques ne sont
 * jamais comparables en base par un simple WHERE - toute deduplication doit
 * se faire en memoire, apres dechiffrement (voir
 * TripHistoryService#findRecent).
 */
@Entity('trip_history_entries')
export class TripHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Pas de @ApiProperty : relation interne, jamais serialisee (meme motif
  // que MobilityProfile.user) - le controleur ne renvoie que
  // TripHistoryEntryDto, jamais l'entite directement.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'origin_lat',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  originLat: number;

  @Column({
    name: 'origin_lon',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  originLon: number;

  @Column({
    name: 'destination_lat',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  destinationLat: number;

  @Column({
    name: 'destination_lon',
    type: 'text',
    transformer: createEncryptedColumnTransformer<number>(),
  })
  destinationLon: number;

  /**
   * Libelle d'adresse lisible (ex. "Part-Dieu"), fourni par le frontend au
   * moment de la recherche (voir SearchTripsDto#originLabel) - nullable car
   * pas toujours disponible (ex. position geolocalisee sans reverse
   * geocoding). Chiffre au meme titre qu'une coordonnee : une adresse
   * textuelle liee a une personne est couverte par la meme obligation RGPD
   * (docs/specs/rgpd-geolocalisation.md section 2.2).
   */
  @Column({
    name: 'origin_label',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<string>(),
  })
  originLabel: string | null;

  @Column({
    name: 'destination_label',
    type: 'text',
    nullable: true,
    transformer: createEncryptedColumnTransformer<string>(),
  })
  destinationLabel: string | null;

  /**
   * Date de la recherche - PAS chiffree (contrairement aux coordonnees) :
   * necessaire en clair pour filtrer par fenetre de retention (WHERE
   * searched_at > ...) et trier par recence directement en SQL, voir
   * TripHistoryService#findRecent/#purgeExpired. Une date de recherche
   * seule, sans coordonnees associees, n'est pas une donnee de
   * geolocalisation sensible.
   */
  @CreateDateColumn({ name: 'searched_at' })
  searchedAt: Date;
}
