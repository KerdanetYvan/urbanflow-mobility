import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GtfsImportService } from './gtfs-import.service';
import { GtfsStop } from './gtfs-stop.entity';

/**
 * Pas de controller : l'ingestion GTFS (issue #12) est une operation
 * d'exploitation ponctuelle lancee via `npm run import:gtfs`
 * (import-gtfs.ts), jamais un endpoint HTTP.
 */
@Module({
  imports: [TypeOrmModule.forFeature([GtfsStop])],
  providers: [GtfsImportService],
  exports: [GtfsImportService],
})
export class GtfsModule {}
