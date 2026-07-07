import { PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { badRequest } from './wsdenatran-error.js';

const collect = (errors: ValidationError[], out: string[] = []): string[] => {
  for (const e of errors) {
    if (e.constraints) out.push(...Object.values(e.constraints));
    if (e.children?.length) collect(e.children, out);
  }
  return out;
};

/**
 * Validates a request body against a DTO class *explicitly* — the class is passed
 * to the constructor, so it does NOT depend on emitted decorator metadata (which
 * tsx/esbuild omits, D-0007). On failure throws a 400 WsdenatranError so the
 * global filter renders it as { returnCode, message }.
 *
 * Usage: `@Body(new DtoValidationPipe(ExameMedicoDto)) body: ExameMedicoDto`.
 */
export class DtoValidationPipe<T extends object> implements PipeTransform {
  constructor(private readonly cls: new () => T) {}

  async transform(value: unknown): Promise<T> {
    const instance = plainToInstance(this.cls, value ?? {});
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      throw badRequest(`Requisição inválida: ${collect(errors).join('; ')}`);
    }
    return instance;
  }
}
