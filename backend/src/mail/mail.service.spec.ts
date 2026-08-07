import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer');

describe('MailService', () => {
  let sendMail: jest.Mock;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    configService = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
  });

  it('envoie l email de reinitialisation avec le lien fourni', async () => {
    const service = new MailService(configService as never);

    await service.sendPasswordResetEmail(
      'alice@example.com',
      'http://localhost:5173/reset-password?token=abc123',
    );

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [message] = sendMail.mock.calls[0] as [
      { to: string; subject: string; text: string; html: string },
    ];
    expect(message.to).toBe('alice@example.com');
    expect(message.subject).toContain('mot de passe');
    expect(message.text).toContain(
      'http://localhost:5173/reset-password?token=abc123',
    );
    expect(message.html).toContain(
      'http://localhost:5173/reset-password?token=abc123',
    );
  });

  it("construit le transport sans authentification si MAIL_USER n'est pas defini", () => {
    new MailService(configService as never);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: undefined }),
    );
  });
});
