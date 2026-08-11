import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OtpModule } from '../otp/otp.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ScoringModule } from '../scoring/scoring.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    OtpModule,
    ScoringModule,
    // ProfilesModule (ProfilesService) pour recuperer le profil de
    // l'utilisateur authentifie ; AuthModule pour la resolution de
    // OptionalJwtAuthGuard (meme motif que ProfilesModule pour JwtAuthGuard)
    // - issue #16.
    ProfilesModule,
    AuthModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
