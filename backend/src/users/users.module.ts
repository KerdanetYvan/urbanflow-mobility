import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    // AuthModule importe pour la resolution de JwtAuthGuard (issue #164,
    // DELETE /users/me protege). forwardRef() obligatoire ici : AuthModule
    // importe deja UsersModule (pour UsersService, voir plus bas) - sans
    // forwardRef() des deux cotes, Nest ne peut pas resoudre ce cycle de
    // modules au demarrage ("Nest can't resolve dependencies...").
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  // Exporte pour que AuthModule puisse rechercher un utilisateur par email
  // lors du login, sans dupliquer cette logique.
  exports: [UsersService],
})
export class UsersModule {}
