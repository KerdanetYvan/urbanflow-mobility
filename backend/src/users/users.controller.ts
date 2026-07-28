import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

/**
 * Endpoint REST /users - pluriel, conforme a la convention de nommage
 * des endpoints du projet (voir CLAUDE.md).
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    // Ne jamais renvoyer passwordHash au client, meme apres inscription.
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
