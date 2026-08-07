import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Envoi d'email (issue #70 - reinitialisation de mot de passe).
 *
 * Transport SMTP generique (nodemailer) pilote entierement par variables
 * d'environnement plutot qu'un SDK de fournisseur (Resend, SendGrid...) :
 * decision prise pour rester auto-heberge et ne pas dependre d'un quota
 * d'envoi tiers (voir backend/README.md, section Authentification). Meme
 * code quel que soit le serveur SMTP en face :
 * - MailHog en developpement (docker-compose.yml) : capture les emails
 *   sans les envoyer reellement, consultables sur http://localhost:8025.
 * - Postfix (image boky/postfix, docker-compose.prod.yml) en production :
 *   relai SMTP sortant auto-heberge. Ne signe pas les emails en DKIM - la
 *   delivrabilite reelle (SPF/DKIM/rDNS sur le domaine) reste une etape
 *   manuelle a configurer cote DNS, non couverte par ce service.
 */
@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly mailFrom: string;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('MAIL_USER');
    const password = this.configService.get<string>('MAIL_PASSWORD');

    this.mailFrom = this.configService.get<string>(
      'MAIL_FROM',
      'no-reply@urbanflow-mobility.local',
    );

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'mailhog'),
      port: this.configService.get<number>('MAIL_PORT', 1025),
      secure: this.configService.get<string>('MAIL_SECURE', 'false') === 'true',
      // Pas d'auth du tout si MAIL_USER est vide (cas de MailHog, qui n'en
      // exige pas) plutot qu'un objet auth avec des champs vides - certains
      // serveurs SMTP rejettent une tentative d'authentification vide.
      auth: user ? { user, pass: password } : undefined,
    });
  }

  /**
   * Envoie l'email de reinitialisation de mot de passe contenant le lien
   * (deja construit par AuthService avec le token en clair - jamais stocke
   * ni logge ici, seul son hash SHA-256 existe en base).
   */
  async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.mailFrom,
      to,
      subject: 'Réinitialisation de votre mot de passe UrbanFlow Mobility',
      text: `Vous avez demande la reinitialisation de votre mot de passe. Suivez ce lien pour en choisir un nouveau (valable une duree limitee) : ${resetUrl}\n\nSi vous n'etes pas a l'origine de cette demande, ignorez cet email.`,
      html: `<p>Vous avez demandé la réinitialisation de votre mot de passe.</p><p><a href="${resetUrl}">Choisir un nouveau mot de passe</a> (lien valable une durée limitée).</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>`,
    });
  }
}
