import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table push_subscriptions (issue #18, F3) : abonnements Web Push d'un
 * utilisateur (voir PushSubscription#entity, backend/src/push/). Coordonnees
 * chiffrees au repos au niveau applicatif (createEncryptedColumnTransformer,
 * colonnes "text" - meme raisonnement que trip_history_entries, voir
 * TripHistoryEntries1787242214767).
 *
 * Note : constraint names choisis explicitement (pas de hash TypeORM
 * auto-genere) - `migration:generate` necessite une base Postgres vivante,
 * indisponible dans l'environnement de redaction de cette migration (pas de
 * Docker local a ce moment - voir sprint-4-plan.md, issue #18). A verifier
 * contre une vraie base au premier `migration:run` avant deploiement.
 */
export class PushSubscriptions1788370733686 implements MigrationInterface {
  name = 'PushSubscriptions1788370733686';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "endpoint" text NOT NULL, "p256dh_key" text NOT NULL, "auth_key" text NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_push_subscriptions_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" ADD CONSTRAINT "FK_push_subscriptions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_push_subscriptions_user_id"`,
    );
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
