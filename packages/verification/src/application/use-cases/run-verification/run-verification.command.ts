import { Command } from '@nestjs/cqrs';

export class RunVerificationCommand extends Command<void> {
  constructor(public readonly packageId: string) {
    super();
  }
}
