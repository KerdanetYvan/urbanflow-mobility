import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Geometrie GeoJSON Point telle qu'exposee par TypeORM pour une colonne
 * postgres de type "geometry" (conversion automatique ST_AsGeoJSON en
 * lecture / ST_GeomFromGeoJSON en ecriture, voir doc TypeORM "Spatial
 * Columns"). `coordinates` est [longitude, latitude], ordre GeoJSON
 * standard - a ne pas confondre avec l'ordre lat/lon utilise ailleurs dans
 * ce projet (ex. OtpClientService.planTrip).
 */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Arret de transport en commun issu de l'ingestion GTFS statique (F3, issue
 * #12). Sous-ensemble volontairement limite du GTFS source (uniquement
 * `stops.txt`) : OpenTripPlanner reste l'unique source de verite pour le
 * routage a partir du graphe complet, cette table sert aux futurs besoins
 * du backend necessitant une recherche geolocalisee (ex. raccourcis de
 * recherche, issue #112) sans avoir a interroger OTP pour ca.
 *
 * `gtfsId` correspond au `stop_id` du flux GTFS source (voir
 * GtfsImportService) - unique par construction dans un flux GTFS valide,
 * utilise comme cle d'upsert pour rendre le reimport idempotent.
 */
@Entity('gtfs_stops')
export class GtfsStop {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'gtfs_id', unique: true })
  gtfsId: string;

  @ApiProperty()
  @Column()
  name: string;

  @ApiProperty()
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: GeoJsonPoint;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
