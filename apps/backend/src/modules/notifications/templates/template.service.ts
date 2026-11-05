import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel } from '@prisma/client';
import Handlebars from 'handlebars';
import mjml2html from 'mjml';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Env } from '../../../shared/config/env.schema';
import { I18nService, type Locale } from '../../../shared/i18n/i18n.service';
import { TEMPLATE_META, type RenderedMessage } from '../notification.types';
import { QrService } from '../qr/qr.service';

const EMAIL_DIR = join(__dirname, 'email');
/** Served by the frontend; email clients fetch it over the public URL. */
const BRAND_LOCKUP_PATH = '/brand/afreximbank-aatc-lockup.png';

function toTemplateVar(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  // Defensive fallback: payloads pre-format objects and dates to strings.
  return JSON.stringify(value) ?? '';
}

/** Templates carry no copy: the `{{t}}` helper pulls localized strings from I18nService. */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly hbs: typeof Handlebars;

  constructor(
    private readonly i18n: I18nService,
    private readonly qr: QrService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.hbs = Handlebars.create();
    // {{t 'key' var=value}} — locale comes from the per-render data root.
    this.hbs.registerHelper(
      't',
      (key: string, options: Handlebars.HelperOptions) => {
        const root = (options.data as { root?: { __locale?: Locale } })?.root;
        const locale: Locale = root?.__locale ?? 'EN';
        return this.i18n.translate(key, locale, options.hash);
      },
    );
  }

  async render(
    templateKey: string,
    channel: NotificationChannel,
    locale: Locale,
    data: Record<string, unknown>,
  ): Promise<RenderedMessage> {
    const meta = TEMPLATE_META[templateKey];
    if (!meta) throw new Error(`Unknown notification template: ${templateKey}`);

    switch (channel) {
      case NotificationChannel.EMAIL:
        return this.renderEmail(meta, locale, data);
      case NotificationChannel.SMS:
        return { text: this.i18n.translate(`sms.${meta.ns}`, locale, data) };
      case NotificationChannel.WHATSAPP: {
        const text = this.i18n.translate(`whatsapp.${meta.ns}`, locale, data);
        const tpl = meta.whatsappTemplate;
        if (!tpl) return { text };
        // The transport decides (via WHATSAPP_USE_TEMPLATES) whether to send it.
        return {
          text,
          template: {
            name: tpl.name,
            languageCode: tpl.languageCode ?? locale.toLowerCase(),
            variables: tpl.vars.map((key) => toTemplateVar(data[key])),
          },
        };
      }
      case NotificationChannel.IN_APP:
        return {
          subject: this.i18n.translate(`inapp.${meta.ns}.title`, locale, data),
          text: this.i18n.translate(`inapp.${meta.ns}.body`, locale, data),
        };
      default:
        throw new Error(`Unsupported channel: ${String(channel)}`);
    }
  }

  private async renderEmail(
    meta: (typeof TEMPLATE_META)[string],
    locale: Locale,
    data: Record<string, unknown>,
  ): Promise<RenderedMessage> {
    const appUrl = (
      this.config.get('APP_PUBLIC_URL', { infer: true }) ?? ''
    ).replace(/\/+$/, '');
    const ctx = {
      ...data,
      __locale: locale,
      year: new Date().getFullYear(),
      // Falls back to the text wordmark in the layout when unset.
      logoUrl: appUrl ? `${appUrl}${BRAND_LOCKUP_PATH}` : '',
    };
    const body = this.compile(`${meta.emailFile}.mjml.hbs`)(ctx);
    const mjml = this.compile('layout.mjml.hbs')({
      ...ctx,
      content: new Handlebars.SafeString(body),
    });
    const { html, errors } = await mjml2html(mjml, { validationLevel: 'soft' });
    if (errors?.length) {
      this.logger.warn(
        `MJML warnings for ${meta.emailFile}: ${errors
          .map((e) => e.message)
          .join('; ')}`,
      );
    }

    const message: RenderedMessage = {
      subject: this.i18n.translate(`email.${meta.ns}.subject`, locale, data),
      html,
    };
    if (meta.withQr && typeof data.code === 'string') {
      message.attachments = [
        {
          filename: 'qr.png',
          content: await this.qr.toPngBuffer(data.code),
          cid: 'qr',
          contentType: 'image/png',
        },
      ];
    }
    return message;
  }

  private compile(file: string): HandlebarsTemplateDelegate {
    const cached = this.cache.get(file);
    if (cached) return cached;
    const src = readFileSync(join(EMAIL_DIR, file), 'utf8');
    const compiled = this.hbs.compile(src);
    this.cache.set(file, compiled);
    return compiled;
  }
}
