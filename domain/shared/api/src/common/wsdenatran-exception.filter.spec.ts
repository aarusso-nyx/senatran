import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WsdenatranExceptionFilter } from './wsdenatran-exception.filter.js';
import { WsdenatranError, businessError } from './wsdenatran-error.js';

function capture() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as never;
  return { res, host };
}

const run = (e: unknown) => {
  const { res, host } = capture();
  new WsdenatranExceptionFilter().catch(e, host);
  return {
    status: res.status.mock.calls[0][0],
    body: res.json.mock.calls[0][0],
  };
};

describe('WsdenatranExceptionFilter', () => {
  it('renders WsdenatranError as {returnCode, message} with status=returnCode', () => {
    const out = run(new WsdenatranError(402, 'boom'));
    expect(out.status).toBe(402);
    expect(out.body).toEqual({ returnCode: 402, message: 'boom' });
  });

  it('carries a business-error domain code in the message', () => {
    const out = run(businessError('RENAINF.AIT.DUPLICATED', 'dup'));
    expect(out.status).toBe(402);
    expect(out.body.message).toContain('RENAINF.AIT.DUPLICATED');
  });

  it('maps a NestJS HttpException to the envelope', () => {
    const out = run(new NotFoundException('nope'));
    expect(out.status).toBe(404);
    expect(out.body).toEqual({ returnCode: 404, message: 'nope' });
  });

  it('joins ValidationPipe messages into one string (400)', () => {
    const out = run(
      new BadRequestException({ message: ['a must be x', 'b required'] }),
    );
    expect(out.status).toBe(400);
    expect(out.body.message).toBe('a must be x; b required');
  });

  it('maps unknown errors to 500', () => {
    const out = run(new Error('kaboom'));
    expect(out.status).toBe(500);
    expect(out.body).toEqual({ returnCode: 500, message: 'Erro interno.' });
  });
});
