import { Module } from '@nestjs/common';
import { OperatorsModule } from '../operators/operators.module';
import { GtfsRealtimeCacheService } from './gtfs-realtime-cache.service';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';

/**
 * Abonnement + detection des perturbations GTFS-Realtime (F3, issue #14) -
 * de TOUS les operateurs configures (OperatorsModule, issue #15). Pas de
 * controller (voir GtfsRealtimeCacheService) : GtfsRealtimeCacheService est
 * exporte pour etre injecte par les modules consommateurs (issue #18 -
 * recalcul + notification push, ScoringModule - penalite de perturbation).
 */
@Module({
  imports: [OperatorsModule],
  providers: [GtfsRealtimeClientService, GtfsRealtimeCacheService],
  exports: [GtfsRealtimeCacheService],
})
export class GtfsRealtimeModule {}
