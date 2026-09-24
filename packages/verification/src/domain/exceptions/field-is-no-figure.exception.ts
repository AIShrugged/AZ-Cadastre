import { DomainException } from '@cadastre/shared';

/*
 * A type declares a field under the key one of the six figures of Article 8 is
 * read under, and the table of provisions names neither this paper as a place
 * that figure is printed nor the field as deliberately something else
 * (COMM-158). The model is asked for a value, the page gives one, and nothing
 * reads it.
 */
export class FieldIsNoFigureException extends DomainException {
  override readonly code = 'FIELD_IS_NO_FIGURE';

  constructor(
    public readonly fieldKey: string,
    public readonly type: string,
  ) {
    super(
      `Document type "${type}" declares field "${fieldKey}", which the table ` +
        'of provisions reads as a figure off other papers but not off this ' +
        'one: name the type beside the figure, or say under `notFigures` why ' +
        'this field is not it',
    );
  }
}
