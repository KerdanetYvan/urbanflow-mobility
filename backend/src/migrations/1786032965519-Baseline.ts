import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline1786032965519 implements MigrationInterface {
  name = 'Baseline1786032965519';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "mobility_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "preferred_transport_modes" text array NOT NULL DEFAULT '{}', "reduced_mobility" boolean NOT NULL DEFAULT false, "max_walking_distance_meters" integer, "max_transfers" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ab9607fdf4f9b2744f6d2c06c8b" UNIQUE ("user_id"), CONSTRAINT "REL_ab9607fdf4f9b2744f6d2c06c8" UNIQUE ("user_id"), CONSTRAINT "PK_2ef80e351ff34e244eaabf47e8d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" ADD CONSTRAINT "FK_ab9607fdf4f9b2744f6d2c06c8b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mobility_profiles" DROP CONSTRAINT "FK_ab9607fdf4f9b2744f6d2c06c8b"`,
    );
    await queryRunner.query(`DROP TABLE "mobility_profiles"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
