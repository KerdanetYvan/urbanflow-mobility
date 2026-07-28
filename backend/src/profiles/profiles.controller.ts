import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

/**
 * Toutes les routes exigent un access token valide (JwtAuthGuard) et
 * n'agissent JAMAIS que sur le profil de l'utilisateur authentifie
 * (`user.sub`, extrait du JWT) - jamais d'id de profil fourni par le
 * client dans l'URL, pour eliminer par construction tout risque d'IDOR
 * (un utilisateur lisant/modifiant le profil de quelqu'un d'autre).
 */
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfileDto) {
    return this.profilesService.create(user.sub, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: JwtPayload) {
    return this.profilesService.findByUserId(user.sub);
  }

  @Patch('me')
  updateMine(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(user.sub, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMine(@CurrentUser() user: JwtPayload) {
    return this.profilesService.remove(user.sub);
  }
}
