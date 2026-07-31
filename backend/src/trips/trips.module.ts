import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [OtpModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
