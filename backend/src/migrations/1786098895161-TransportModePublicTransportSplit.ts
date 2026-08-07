import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransportModePublicTransportSplit1786098895161 implements MigrationInterface {
  name = 'TransportModePublicTransportSplit1786098895161';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Issue #66 : l'ancien mode generique "public_transport" est eclate en
    // 4 modes geres par des operateurs differents (bus/tram/metro/train_ter,
    // voir TransportMode). Pas d'ADD COLUMN ici contrairement a la migration
    // #68 : preferred_transport_modes existe deja en text[], on backfille
    // juste les valeurs en place. Choix assume vers "bus" (mode le plus
    // represente de l'ancien "transports en commun" generique) : impossible
    // de deviner quel(s) mode(s) precis l'utilisateur visait a l'origine.
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "preferred_transport_modes" = array_remove("preferred_transport_modes", 'public_transport') || '{bus}' WHERE 'public_transport' = ANY("preferred_transport_modes")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversion approximative, meme limite que AccessibilityPreferences
    // 1786033404958.down() : on ne peut pas distinguer un "bus" backfille
    // ici d'un "bus" choisi manuellement par l'utilisateur apres coup.
    await queryRunner.query(
      `UPDATE "mobility_profiles" SET "preferred_transport_modes" = array_remove("preferred_transport_modes", 'bus') || '{public_transport}' WHERE 'bus' = ANY("preferred_transport_modes")`,
    );
  }
}
