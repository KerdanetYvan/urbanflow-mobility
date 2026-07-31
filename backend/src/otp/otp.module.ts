import { Module } from '@nestjs/common';
import { OtpClientService } from './otp-client.service';

/**
 * Client OTP partage (issue #6 puis #81) : TripsModule (planification
 * d'itineraires) et PlacesModule (geocodage) parlent tous les deux a OTP,
 * via le meme client plutot que d'en dupliquer un chacun.
 */
@Module({
  providers: [OtpClientService],
  exports: [OtpClientService],
})
export class OtpModule {}
