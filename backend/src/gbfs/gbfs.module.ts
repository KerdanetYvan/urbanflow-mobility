import { Module } from '@nestjs/common';
import { OperatorsModule } from '../operators/operators.module';
import { GbfsCacheService } from './gbfs-cache.service';
import { GbfsClientService } from './gbfs-client.service';
import { GbfsController } from './gbfs.controller';

/**
 * Ingestion des flux GBFS de mobilite partagee (F3, issue #13) - de TOUS
 * les operateurs configures (OperatorsModule, issue #15). Ne depend
 * d'aucun autre module de persistance - contrairement a GtfsModule (upsert
 * dans PostGIS) la disponibilite GBFS n'est jamais persistee, seulement
 * mise en cache memoire (voir GbfsCacheService).
 */
@Module({
  imports: [OperatorsModule],
  controllers: [GbfsController],
  providers: [GbfsClientService, GbfsCacheService],
})
export class GbfsModule {}
