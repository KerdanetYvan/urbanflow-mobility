import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard a poser sur tout endpoint necessitant un utilisateur authentifie
 * (ex. @UseGuards(JwtAuthGuard)). Delegue a JwtStrategy pour la verification
 * du token ; renvoie 401 automatiquement si absent/invalide/expire.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
