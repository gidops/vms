import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodIssue, ZodType } from 'zod';

/** A single validation failure, carried in a shape the filter can localize. */
export interface ValidationIssue {
  path: string;
  /** Zod issue code (e.g. invalid_type, too_small) → `validation.<code>` key. */
  code: string;
  /** Interpolation vars for the localized message (path + code-specific fields). */
  params: Record<string, unknown>;
  /** Raw zod message, used as a fallback when no catalog entry exists. */
  message: string;
}

/**
 * Validates/parses a payload against a zod schema (e.g. from @vms/contracts).
 * On failure it throws structured, locale-agnostic issues (code + params); the
 * global exception filter turns them into localized messages. Kept DI-free so it
 * can still be used inline as `new ZodValidationPipe(Schema)` in controllers.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        // A catalog key; the filter localizes it for the response title/detail.
        message: 'errors.validationFailed',
        errors: result.error.issues.map((issue) => this.toIssue(issue)),
      });
    }
    return result.data;
  }

  private toIssue(issue: ZodIssue): ValidationIssue {
    const path = issue.path.join('.') || '(root)';
    // Pull the code-specific fields zod attaches (minimum, maximum, …), for
    // interpolation — minus the structural ones we set explicitly.
    const rest: Record<string, unknown> = { ...issue };
    delete rest.code;
    delete rest.message;
    delete rest.path;
    return {
      path,
      code: issue.code,
      params: { path, ...rest },
      message: issue.message,
    };
  }
}
