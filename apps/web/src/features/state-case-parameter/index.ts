/**
 * state-case-parameter — an operator setting one of the six figures the Article 8
 * decision table decides on, in the cell of the table the figure is printed in
 * (COMM-193, COMM-194).
 *
 * The second write on the case screen that changes what the case is *decided on*
 * rather than what it has been told, and it is not a correction — which is why it
 * is its own feature and its own endpoint. Correcting the field a figure was read
 * off cannot reach three of the six: a parameter may have no reading at all, the
 * right over the land comes from the *kind* of title document rather than any
 * line of one, and the span is calculated out of the axis chains. Where an
 * operator has stated a figure the case is decided on theirs and on nothing else;
 * what the engine read is kept beside it and published, so the cell shows both
 * and offers to put the engine's back. Reverting is clearing the override, never
 * writing the old figure back over it.
 *
 * Everything the reader meets is `correct-field`'s vocabulary — the same pencil,
 * the same "not saved" mark, the same bar and the same consequence — because it
 * is the same act on a different object, and the parts both features draw live in
 * `shared/ui` rather than in either of them.
 *
 * The feature owns the draft, the save and the wording; the panel owns the cell.
 * That split is the one `correct-field` draws for the same reason: the cell
 * already carries the figure, its source, the sheet jump and the span working,
 * and none of those become this feature's business for the sake of putting a box
 * in the middle of them.
 *
 * **Operator only, and this client does not enforce it.** The case screen lives
 * under the operator's branch of the route map and an applicant never reaches it;
 * the service refuses the call outright for anyone else (403). A guard drawn here
 * as well would be a second opinion about permission, which is the one thing this
 * client keeps out of (ADR-0029).
 */
export type {
  BadFigure,
  Draft,
  FigureKind,
  FigureReading,
  NoStatement,
  Statements,
} from './model';
export {
  FIGURE_CHOICES,
  FIGURE_KIND,
  isOverridden,
  useStatements,
  whyNotStatable,
} from './model';
export {
  FigureBox,
  NoStatementsNote,
  RevertFigure,
  StatementBar,
  StateFigureButton,
} from './ui/state-case-parameter';
