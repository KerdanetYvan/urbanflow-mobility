import { Module } from '@nestjs/common';
import { GtfsRealtimeCacheService } from './gtfs-realtime-cache.service';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';

/**
 * Abonnement + detection des perturbations GTFS-Realtime (F3, issue #14).
 * Pas de controller (voir GtfsRealtimeCacheService) : GtfsRealtimeCacheService
 * est exporte pour etre injecte par un futur module consommateur (issue
 * #18 - recalcul + notification push).
 */
@Module({
  providers: [GtfsRealtimeClientService, GtfsRealtimeCacheService],
  exports: [GtfsRealtimeCacheService],
})
export class GtfsRealtimeModule {}
