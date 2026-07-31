import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
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
}
