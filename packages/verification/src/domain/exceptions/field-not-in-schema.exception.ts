import { DomainException } from '@cadastre/shared';

export class FieldNotInSchemaException extends DomainException {
  override readonly code = 'FIELD_NOT_IN_SCHEMA';

  constructor(
    public readonly fieldKey: string,
    public readonly type: string,
  ) {
    super(`Document type "${type}" declares no field "${fieldKey}"`);
  }
}
