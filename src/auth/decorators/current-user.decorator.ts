import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    console.log('Extracting current user from request context');
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
