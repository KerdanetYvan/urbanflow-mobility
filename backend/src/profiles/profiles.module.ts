import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MobilityProfile } from './mobility-profile.entity';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  // AuthModule importe pour la resolution propre de JwtAuthGuard/JwtStrategy
  // (deja exportes par AuthModule) utilises par ProfilesController.
  imports: [TypeOrmModule.forFeature([MobilityProfile]), AuthModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  // ProfilesService expose (issue #16) : TripsModule en a besoin pour
  // recuperer le profil de l'utilisateur authentifie et personnaliser le
  // classement des itineraires (voir ScoringService).
  exports: [ProfilesService],
})
export class ProfilesModule {}
