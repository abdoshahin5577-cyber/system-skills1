import { env } from '../config/env';
import { logger } from '../config/logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Placeholder mailer until the BullMQ + SMTP phase. It does NOT send real email:
 * - test: collects messages in `outbox` so tests can read verification/reset links
 * - development: prints the message (including links) to the console
 * - production: logs a warning that nothing was sent
 */
export class ConsoleMailer implements Mailer {
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    if (env.NODE_ENV === 'test') {
      this.outbox.push(message);
    } else if (env.NODE_ENV === 'development') {
      logger.info({ to: message.to, subject: message.subject, text: message.text }, 'DEV mail (not sent)');
    } else {
      logger.warn({ to: message.to, subject: message.subject }, 'Email provider not configured; message NOT sent');
    }
  }
}
