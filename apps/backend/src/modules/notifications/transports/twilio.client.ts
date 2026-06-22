import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio, { type Twilio } from 'twilio';
import type { Env } from '../../../shared/config/env.schema';

/**
 * Lazily-constructed shared Twilio client used by both the SMS and WhatsApp
 * transports (one account serves both channels). Returns undefined when Twilio
 * isn't configured so callers can fall back to logging.
 */
@Injectable()
export class TwilioClientProvider {
  private client?: Twilio;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get('TWILIO_ACCOUNT_SID', { infer: true }) &&
      this.config.get('TWILIO_AUTH_TOKEN', { infer: true }),
    );
  }

  getClient(): Twilio | undefined {
    if (!this.isConfigured) return undefined;
    if (!this.client) {
      this.client = twilio(
        this.config.get('TWILIO_ACCOUNT_SID', { infer: true }),
        this.config.get('TWILIO_AUTH_TOKEN', { infer: true }),
      );
    }
    return this.client;
  }
}
