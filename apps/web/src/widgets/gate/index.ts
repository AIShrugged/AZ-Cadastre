/**
 * gate — the frame for the pages a reader reaches without a session, and for
 * the two moments either side of them.
 *
 * The signed-out counterpart of `app-shell`, and its own widget for the same
 * reason that one is: more than one page is drawn in it, and none of them owns
 * it.
 */
export { Gate, GateHold, GateUnreachable } from './ui/gate';
export { GateField } from './ui/gate-field';
