import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { StringValue } from 'ms';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    // JwtModule est configure ici avec le secret d'ACCES par defaut ;
    // AuthService fournit explicitement JWT_REFRESH_SECRET a chaque appel
    // signAsync/verifyAsync concernant le refresh token (voir auth.service.ts).
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          // Cast StringValue : la lib jsonwebtoken/ms attend un format precis
          // ("15m", "7d"...) type au niveau des template literals ; la
          // valeur vient de l'environnement (simple string), d'ou le cast.
          expiresIn: config.get<string>('JWT_EXPIRATION', '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
