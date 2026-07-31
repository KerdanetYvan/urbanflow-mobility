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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MobilityProfile } from './mobility-profile.entity';
import { ProfilesService } from './profiles.service';

/**
 * Toutes les routes exigent un access token valide (JwtAuthGuard) et
 * n'agissent JAMAIS que sur le profil de l'utilisateur authentifie
 * (`user.sub`, extrait du JWT) - jamais d'id de profil fourni par le
 * client dans l'URL, pour eliminer par construction tout risque d'IDOR
 * (un utilisateur lisant/modifiant le profil de quelqu'un d'autre).
 */
@ApiTags('profiles')
@ApiBearerAuth('access-token')
@ApiResponse({ status: 401, description: 'Jeton absent, invalide ou expire' })
@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cree le profil de mobilite (F1)' })
  @ApiResponse({ status: 201, type: MobilityProfile })
  @ApiResponse({
    status: 409,
    description: 'Un profil existe deja pour cet utilisateur',
  })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProfileDto) {
    return this.profilesService.create(user.sub, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Recupere mon profil de mobilite' })
  @ApiResponse({ status: 200, type: MobilityProfile })
  @ApiResponse({
    status: 404,
    description: 'Pas encore de profil pour cet utilisateur',
  })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.profilesService.findByUserId(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Met a jour mon profil de mobilite (partiel)' })
  @ApiResponse({ status: 200, type: MobilityProfile })
  @ApiResponse({
    status: 404,
    description: 'Pas encore de profil pour cet utilisateur',
  })
  updateMine(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(user.sub, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprime mon profil de mobilite' })
  @ApiResponse({ status: 204, description: 'Profil supprime' })
  @ApiResponse({
    status: 404,
    description: 'Pas encore de profil pour cet utilisateur',
  })
  removeMine(@CurrentUser() user: JwtPayload) {
    return this.profilesService.remove(user.sub);
  }
}
