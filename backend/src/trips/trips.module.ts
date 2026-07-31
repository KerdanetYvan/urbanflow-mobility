import { Module } from '@nestjs/common';
import { OtpClientService } from './otp-client.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  controllers: [TripsController],
  providers: [TripsService, OtpClientService],
})
export class TripsModule {}
