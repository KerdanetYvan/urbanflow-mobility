import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { RegisteredUserDto } from './dto/registered-user.dto';
import { UsersService } from './users.service';

/**
 * Endpoint REST /users - pluriel, conforme a la convention de nommage
 * des endpoints du projet (voir CLAUDE.md).
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Inscription (F1)',
    description:
      "Cree un compte. Ne connecte pas automatiquement l'utilisateur - voir POST /auth/login juste apres.",
  })
  @ApiResponse({ status: 201, type: RegisteredUserDto })
  @ApiResponse({
    status: 400,
    description: 'Email invalide ou mot de passe trop faible',
  })
  @ApiResponse({ status: 409, description: 'Email deja utilise' })
  async register(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    // Ne jamais renvoyer passwordHash au client, meme apres inscription.
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Supprime definitivement mon compte (droit a l'effacement, RGPD article 17 - issue #164)",
    description:
      "Supprime le compte et, par cascade (onDelete: 'CASCADE'), toutes les donnees liees (profil de mobilite, historique de trajets, trajet suivi, abonnements push). Action irreversible : le mot de passe est requis en confirmation (voir DeleteAccountDto).",
  })
  @ApiResponse({
    status: 204,
    description: 'Compte et donnees liees supprimes',
  })
  @ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expire' })
  @ApiResponse({
    status: 403,
    description:
      // 403, pas 401 : voir le commentaire de UsersService#remove pour le
      // pourquoi (401 declencherait a tort le rafraichissement automatique
      // de jeton cote frontend).
      'Mot de passe de confirmation incorrect',
  })
  async removeMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.usersService.remove(user.sub, dto.password);
  }
}
