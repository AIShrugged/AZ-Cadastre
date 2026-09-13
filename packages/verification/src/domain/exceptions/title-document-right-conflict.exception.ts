import { DomainException } from '@cadastre/shared';

// A profile listing one title document under two items that confer different
// rights. Thrown when the profile is built, which is at import time: the class
// of a case is read off the type of its title, and a type that confers two
// rights would make that class depend on which item was read first.
export class TitleDocumentRightConflictException extends DomainException {
  override readonly code = 'TITLE_DOCUMENT_RIGHT_CONFLICT';

  constructor(
    public readonly type: string,
    public readonly items: readonly string[],
  ) {
    super(
      `Title document "${type}" is listed under items ${items.join(', ')} ` +
        `with different rights over the land`,
    );
  }
}
