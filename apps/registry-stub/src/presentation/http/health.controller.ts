import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  // What a compose healthcheck and the caller's start-up wait ask. It says the
  // process is answering, and nothing about whether the register loaded.
  @Get()
  get(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
