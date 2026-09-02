import { Module } from '@nestjs/common';
import { GtfsRealtimeModule } from '../gtfs-realtime/gtfs-realtime.module';
import { WeatherModule } from '../weather/weather.module';
import { ScoringService } from './scoring.service';

@Module({
  imports: [WeatherModule, GtfsRealtimeModule],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
