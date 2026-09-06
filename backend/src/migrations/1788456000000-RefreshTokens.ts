import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Table refresh_tokens (issue #268, A07 OWASP) : trace des refresh tokens
 * emis, support de la rotation stricte avec detection de rejeu. Voir
 * RefreshToken#entity et docs/audits/owasp-audit.md section 4.
 *
 * Meme note que PushSubscriptions1788370733686 / FollowedTrips1788370733687
 * sur les noms de contrainte (nommes a la main, pas de hash TypeORM
 * auto-genere : pas de base Postgres vivante disponible au moment de la
 * redaction de la migration).
 */
export class RefreshTokens1788456000000 implements MigrationInterface {
  name = 'RefreshTokens1788456000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL, "family_id" uuid NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP NOT NULL, "consumed_at" TIMESTAMP, "revoked_at" TIMESTAMP, "replaced_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_family_id" ON "refresh_tokens" ("family_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_user_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_refresh_tokens_family_id"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
  }
}
