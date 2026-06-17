import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int(),
  });
  const pipe = new ZodValidationPipe(schema);

  it('returns parsed data for a valid payload', () => {
    expect(pipe.transform({ email: 'a@b.com', age: 30 })).toEqual({
      email: 'a@b.com',
      age: 30,
    });
  });

  it('throws BadRequestException for an invalid payload', () => {
    expect(() => pipe.transform({ email: 'nope', age: 1.5 })).toThrow(
      BadRequestException,
    );
  });

  it('includes per-field errors in the response body', () => {
    let captured: BadRequestException | undefined;
    try {
      pipe.transform({ email: 'nope' });
    } catch (e) {
      captured = e as BadRequestException;
    }
    const body = captured?.getResponse() as {
      message: string;
      errors: { path: string; message: string }[];
    };
    expect(body.message).toBe('Validation failed');
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0]).toHaveProperty('path');
  });
});
