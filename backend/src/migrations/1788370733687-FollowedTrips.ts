import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table followed_trips (issue #18, F3) : le trajet actuellement suivi par un
 * utilisateur, au plus un par utilisateur (contrainte UNIQUE sur user_id,
 * meme pattern OneToOne que mobility_profiles - voir Baseline1786032965519).
 * Coordonnees/libelles chiffres au repos (createEncryptedColumnTransformer),
 * `end_time` et `last_notified_disruption_signature` en clair (voir
 * FollowedTrip#entity pour le detail du contrat RGPD).
 *
 * Meme note que PushSubscriptions1788370733686 sur les noms de contrainte
 * (pas de hash TypeORM auto-genere, pas de base Postgres vivante disponible
 * au moment de la redaction).
 */
export class FollowedTrips1788370733687 implements MigrationInterface {
  name = 'FollowedTrips1788370733687';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "followed_trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "origin_lat" text NOT NULL, "origin_lon" text NOT NULL, "origin_label" text, "destination_lat" text NOT NULL, "destination_lon" text NOT NULL, "destination_label" text, "segments" text NOT NULL, "transport_modes" text array, "end_time" TIMESTAMP NOT NULL, "last_notified_disruption_signature" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_followed_trips_user_id" UNIQUE ("user_id"), CONSTRAINT "PK_followed_trips_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "followed_trips" ADD CONSTRAINT "FK_followed_trips_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "followed_trips" DROP CONSTRAINT "FK_followed_trips_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "followed_trips"`);
  }
}
