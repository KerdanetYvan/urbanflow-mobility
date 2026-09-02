import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { GbfsModule } from './gbfs/gbfs.module';
import { GtfsModule } from './gtfs/gtfs.module';
import { GtfsRealtimeModule } from './gtfs-realtime/gtfs-realtime.module';
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
    // Enregistrement global du scheduler NestJS (necessaire une seule fois
    // pour toute l'app) - utilise par TripHistoryService (issue #11) pour
    // la purge quotidienne automatique de l'historique perime (RGPD, voir
    // docs/specs/rgpd-geolocalisation.md section 3.1).
    ScheduleModule.forRoot(),
    // Limitation de debit (issue #21, audit OWASP - A04 Conception non
    // securisee) : configuration disponible pour toute l'app, mais le garde
    // ThrottlerGuard n'est applique qu'aux endpoints sensibles
    // (AuthController) plutot qu'en garde global - inutile de limiter le
    // debit d'une recherche d'itineraire publique (GET /trips) de la meme
    // facon qu'une tentative de connexion, qui est la seule cible reelle
    // d'une attaque par force brute sur cette API.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          // 10 requetes / minute / IP : large marge pour un usage legitime
          // (quelques essais de mot de passe, un rafraichissement de jeton),
          // suffisamment bas pour freiner une attaque automatisee.
          ttl: 60_000,
          limit: 10,
        },
      ],
    }),
    UsersModule,
    AuthModule,
    ProfilesModule,
    TripsModule,
    PlacesModule,
    GtfsModule,
    GbfsModule,
    GtfsRealtimeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
