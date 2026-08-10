import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GtfsModule } from './gtfs/gtfs.module';
import { PlacesModule } from './places/places.module';
import { ProfilesModule } from './profiles/profiles.module';
import { TripsModule } from './trips/trips.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        // Le schema est desormais gere par les migrations TypeORM (voir
        // src/data-source.ts et src/migrations/, lancees via
        // `npm run migration:run` avant le demarrage de l'app - Dockerfiles
        // de dev et de prod). synchronize reste controle par sa propre
        // variable (independante de NODE_ENV) comme garde-fou manuel, mais
        // doit rester a false en usage normal pour ne pas diverger des
        // migrations.
        synchronize: config.get<string>('TYPEORM_SYNC', 'false') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    ProfilesModule,
    TripsModule,
    PlacesModule,
    GtfsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
