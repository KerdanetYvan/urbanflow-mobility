import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  // Exporte pour que AuthModule puisse rechercher un utilisateur par email
  // lors du login, sans dupliquer cette logique.
  exports: [UsersService],
})
export class UsersModule {}
