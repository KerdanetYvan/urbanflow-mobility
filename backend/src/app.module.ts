import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
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
        // Controle par sa propre variable plutot que deduit de NODE_ENV :
        // synchronize (creation automatique du schema) et "on tourne en
        // production" sont deux questions independantes. Tant qu'aucune
        // migration TypeORM n'existe (voir issue de durcissement a venir),
        // TYPEORM_SYNC=true reste necessaire meme en production pour que
        // les tables se creent. A repasser a false une fois les migrations
        // en place.
        synchronize: config.get<string>('TYPEORM_SYNC', 'false') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    ProfilesModule,
    TripsModule,
    PlacesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
