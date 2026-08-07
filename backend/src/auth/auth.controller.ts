import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenPairDto } from './dto/token-pair.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion (F1)' })
  @ApiResponse({ status: 200, type: TokenPairDto })
  @ApiResponse({
    status: 401,
    description:
      "Email ou mot de passe incorrect (message volontairement identique dans les deux cas - pas d'enumeration d'utilisateurs)",
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Echange un refresh token valide contre une nouvelle paire de jetons',
  })
  @ApiResponse({ status: 200, type: TokenPairDto })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expire' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demande de reinitialisation de mot de passe (issue #70)',
    description:
      "Envoie un email contenant un lien de reinitialisation si l'email correspond a un compte. Reponse volontairement identique dans tous les cas (pas d'enumeration d'utilisateurs, meme raisonnement que POST /auth/login).",
  })
  @ApiResponse({
    status: 200,
    description: "Message generique, que l'email existe ou non",
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmation de reinitialisation de mot de passe (issue #70)',
  })
  @ApiResponse({ status: 200, description: 'Mot de passe reinitialise' })
  @ApiResponse({
    status: 400,
    description: 'Token invalide, expire, ou nouveau mot de passe trop faible',
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
