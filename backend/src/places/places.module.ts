import { Module } from '@nestjs/common';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { OtpModule } from '../otp/otp.module';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  // OTP pour les arrets, Nominatim pour les adresses (issue #167/#168).
  imports: [OtpModule, GeocodingModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
