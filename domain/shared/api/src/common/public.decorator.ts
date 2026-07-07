import { SetMetadata } from '@nestjs/common';

/** Marks a route as exempt from the x-cpf-usuario auth guard (e.g. /health). */
export const IS_PUBLIC = 'senatran:isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC, true);
