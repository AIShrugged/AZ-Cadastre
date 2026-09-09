/**
 * approve-archive-search — the feature that lets a person sign for what the
 * archive register answered about a submission, and states the conclusion they
 * drew from it (ADR-0016).
 *
 * The panel is the whole feature: the form while nothing is in force, the
 * record once something is, the reason when neither is possible, and the
 * approvals the search has outrun. There is no author anywhere in it and no
 * place kept for one — the system has no accounts, and a name typed into a box
 * is the appearance of accountability rather than the thing.
 *
 * **Only an administrator may approve one, and nothing here enforces it.** The
 * gateway says the same in the same words: there is no authentication and there
 * are no accounts, so there is nobody to tell an administrator from — a control
 * this client drew would be a lock with the key taped to it. The restriction is
 * written down and unenforced rather than faked, and the guard attaches at the
 * endpoint when accounts arrive, not here.
 */
export { ApproveArchiveSearch } from './ui/approve-archive-search';
export { ApprovalRecord } from './ui/approval-record';
