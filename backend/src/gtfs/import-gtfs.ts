import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GtfsImportService } from './gtfs-import.service';

/**
 * Script d'ingestion du GTFS statique de la metropole (issue #12), lance
 * via `npm run import:gtfs`. Meme pattern que src/seed/seed.ts :
 * createApplicationContext plutot que create() (pas besoin du serveur
 * HTTP, juste du container de dependances pour resoudre GtfsImportService
 * et sa connexion TypeORM).
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gtfsImportService = app.get(GtfsImportService);

  console.log('Import du flux GTFS…\n');
  const summary = await gtfsImportService.run();

  console.log('\n✓ Import termine :');
  console.log(`  Arrets upsertes : ${summary.stopsUpserted}`);
  console.log(`  Lignes validees : ${summary.routesValidated}`);
  console.log(`  Courses validees : ${summary.tripsValidated}`);
  console.log(`  Calendriers valides : ${summary.calendarValidated}`);

  await app.close();
}

main().catch((error) => {
  console.error("Échec de l'import GTFS :", error);
  process.exitCode = 1;
});
