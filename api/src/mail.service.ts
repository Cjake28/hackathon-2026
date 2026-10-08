import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';

// Sends email through the SMTP_* settings in .env. Without SMTP_HOST, emails are printed to the API console.
@Injectable()
export class MailService {
  private transport = process.env.SMTP_HOST
    ? createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_PORT === '465',
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    : null;

  async send(to: string, subject: string, text: string) {
    if (!this.transport) {
      console.log(`\n[mail] to: ${to}\n[mail] subject: ${subject}\n${text}\n`);
      return;
    }
    await this.transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    });
  }
}
