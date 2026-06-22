import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Supported backend locales (mirror of the contracts/Prisma Locale enum). */
export const LOCALES = ['EN', 'FR', 'AR'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'EN';

type Catalog = Record<string, unknown>;

/**
 * Normalize any locale-ish input (e.g. "en", "fr-FR", "AR") to a backend Locale,
 * falling back to EN. A pure function so the request middleware can use it
 * without pulling in the DI container.
 */
export function normalizeLocale(input?: string | null): Locale {
  if (!input) return DEFAULT_LOCALE;
  const code = input.trim().slice(0, 2).toUpperCase();
  return (LOCALES as readonly string[]).includes(code)
    ? (code as Locale)
    : DEFAULT_LOCALE;
}

/**
 * Backend localization. Loads per-locale message catalogs (JSON, mirroring the
 * frontend's namespaced structure) and resolves dot-paths with `{var}`
 * interpolation. Used both by the notification templating layer and by the API
 * error/validation path so the backend is the single source of truth for
 * localized strings. Falls back to EN, then to the raw key, so a missing
 * translation degrades gracefully instead of throwing.
 */
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

  /** Normalize any locale-ish input (e.g. "en", "fr-FR", "AR") to a Locale. */
  resolveLocale(input?: string | null): Locale {
    return normalizeLocale(input);
  }

  /**
   * Translate a dot-path key for a locale, interpolating `{var}` placeholders.
   * Resolution order: requested locale → EN → the key itself.
   */
  translate(
    key: string,
    locale: Locale = DEFAULT_LOCALE,
    vars?: Record<string, unknown>,
  ): string {
    const raw =
      this.lookup(key, locale) ?? this.lookup(key, DEFAULT_LOCALE) ?? key;
    return this.interpolate(raw, vars);
  }

  /** True when the key resolves to a string in any catalog (key vs. free text). */
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
