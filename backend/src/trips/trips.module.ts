import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { OtpModule } from '../otp/otp.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScoringModule } from '../scoring/scoring.module';
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
    // un utilisateur authentifie, voir TripHistoryService.
    TypeOrmModule.forFeature([TripHistoryEntry]),
  ],
  controllers: [TripsController],
  providers: [TripsService, TripHistoryService],
})
export class TripsModule {}
