import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodIssue, ZodType } from 'zod';

export interface ValidationIssue {
  path: string;
  /** Maps to the `validation.<code>` catalog key. */
  code: string;
  params: Record<string, unknown>;
  message: string;
}

/** Throws locale-agnostic issues; the exception filter localizes them. */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'errors.validationFailed',
        errors: result.error.issues.map((issue) => this.toIssue(issue)),
      });
    }
    return result.data;
  }

  private toIssue(issue: ZodIssue): ValidationIssue {
    const path = issue.path.join('.') || '(root)';
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
