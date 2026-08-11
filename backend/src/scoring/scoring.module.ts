import { Module } from '@nestjs/common';
import { WeatherModule } from '../weather/weather.module';
import { ScoringService } from './scoring.service';

@Module({
  imports: [WeatherModule],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
