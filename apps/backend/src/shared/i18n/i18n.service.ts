import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Mirrors the Prisma Locale enum. */
const LOCALES = ['EN', 'FR', 'AR'] as const;
export type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'EN';

type Catalog = Record<string, unknown>;

/** Pure so the request middleware can use it without the DI container. */
export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const code = input.trim().slice(0, 2).toUpperCase();
  return (LOCALES as readonly string[]).includes(code)
    ? (code as Locale)
    : DEFAULT_LOCALE;
}

/** Falls back to EN, then the raw key, so a missing translation never throws. */
@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);
  private readonly catalogs = new Map<Locale, Catalog>();

  constructor() {
    for (const locale of LOCALES) {
      this.catalogs.set(locale, this.load(locale));
    }
  }

  private load(locale: Locale): Catalog {
    try {
      const file = join(__dirname, 'messages', `${locale.toLowerCase()}.json`);
      return JSON.parse(readFileSync(file, 'utf8')) as Catalog;
    } catch (err) {
      this.logger.error(
        `Failed to load i18n catalog for ${locale}: ${(err as Error).message}`,
      );
      return {};
    }
  }

  resolveLocale(input?: string | null): Locale {
    return normalizeLocale(input);
  }

  translate(
    key: string,
    locale: Locale = DEFAULT_LOCALE,
    vars?: Record<string, unknown>,
  ): string {
    const raw =
      this.lookup(key, locale) ?? this.lookup(key, DEFAULT_LOCALE) ?? key;
    return this.interpolate(raw, vars);
  }

  /** Distinguishes a catalog key from free text. */
  has(key: string): boolean {
    return (
      this.lookup(key, DEFAULT_LOCALE) !== undefined ||
      LOCALES.some((l) => this.lookup(key, l) !== undefined)
    );
  }

  private lookup(key: string, locale: Locale): string | undefined {
    const catalog = this.catalogs.get(locale);
    if (!catalog) return undefined;
    let node: unknown = catalog;
    for (const part of key.split('.')) {
      if (node && typeof node === 'object' && part in (node as Catalog)) {
        node = (node as Catalog)[part];
      } else {
        return undefined;
      }
    }
    return typeof node === 'string' ? node : undefined;
  }

  private interpolate(text: string, vars?: Record<string, unknown>): string {
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  }
}
