import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OtpModule } from '../otp/otp.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScoringModule } from '../scoring/scoring.module';
import { FollowedTrip } from './following/followed-trip.entity';
import { FollowedTripController } from './following/followed-trip.controller';
import { FollowedTripService } from './following/followed-trip.service';
import { TripHistoryEntry } from './history/trip-history-entry.entity';
import { TripHistoryService } from './history/trip-history.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    OtpModule,
    ScoringModule,
    // ProfilesModule (ProfilesService) pour recuperer le profil de
    // l'utilisateur authentifie ; AuthModule pour la resolution de
    // OptionalJwtAuthGuard/JwtAuthGuard (meme motif que ProfilesModule pour
    // JwtAuthGuard) - issue #16.
    ProfilesModule,
    AuthModule,
    // TripHistoryEntry (issue #11) : historique des trajets recherches par
    // un utilisateur authentifie, voir TripHistoryService. FollowedTrip
    // (issue #18) : le trajet actuellement suivi, voir FollowedTripService.
    TypeOrmModule.forFeature([TripHistoryEntry, FollowedTrip]),
  ],
  controllers: [TripsController, FollowedTripController],
  providers: [TripsService, TripHistoryService, FollowedTripService],
  // TripsService/FollowedTripService reutilises par PerturbationsModule
  // (issue #18, voir trip-disruption-monitor.service.ts) - recalcul et
  // detection sur les trajets suivis.
  exports: [TripsService, FollowedTripService],
})
export class TripsModule {}
