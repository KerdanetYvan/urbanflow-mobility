import { Module } from '@nestjs/common';
import { GbfsCacheService } from './gbfs-cache.service';
import { GbfsClientService } from './gbfs-client.service';
import { GbfsController } from './gbfs.controller';

/**
 * Ingestion des flux GBFS de mobilite partagee (F3, issue #13). Ne depend
 * d'aucun autre module - contrairement a GtfsModule (upsert dans PostGIS)
 * la disponibilite GBFS n'est jamais persistee, seulement mise en cache
 * memoire (voir GbfsCacheService).
 */
@Module({
  controllers: [GbfsController],
  providers: [GbfsClientService, GbfsCacheService],
})
export class GbfsModule {}
