import { Module } from '@nestjs/common';
import { GtfsRealtimeModule } from '../gtfs-realtime/gtfs-realtime.module';
import { PushModule } from '../push/push.module';
import { TripsModule } from '../trips/trips.module';
import { TripDisruptionMonitorService } from './trip-disruption-monitor.service';

/**
 * Recalcul automatique et notification push sur perturbation (issue #18) -
 * assemble les briques deja livrees par #13/#14 (perturbations detectees),
 * le suivi de trajet (FollowedTripService, trips/following/) et l'envoi
 * push (PushModule) sans dupliquer leur logique.
 */
@Module({
  imports: [TripsModule, GtfsRealtimeModule, PushModule],
  providers: [TripDisruptionMonitorService],
})
export class PerturbationsModule {}
