import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  imports: [OtpModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
