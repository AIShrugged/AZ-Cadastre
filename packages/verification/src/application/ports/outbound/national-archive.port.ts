import type { IssuingAuthorityKind } from '../../../domain/value-objects/index.js';

/**
 * The archive's copy of one paper, as it states it. Each line is the archive's
 * own value, null where its entry gives none; the issuing body is named and
 * typed, because the kind of body a fund was created by is a fact the archive
 * keeps about its holdings (ADR-0028).
 */
export type ArchivedDocument = {
  documentNo: string | null;
  issuedOn: string | null;
  issuingAuthority: {
    name: string;
    kind: IssuingAuthorityKind;
  };
  holderName: string | null;
  propertyAddress: string | null;
  plotArea: string | null;
  decreeItem: string | null;
  // Fond, inventory, file and sheet, in the archive's own words.
  archiveReference: string | null;
};

export type ArchiveQrAnswer =
  | {
      outcome: 'Found';
      document: ArchivedDocument;
      // The audit line: who answered, from what.
      note: string;
    }
  | {
      outcome: 'NotFound';
      note: string;
    };

/**
 * The National Archive Fund, as this context needs it: asked by the QR reference
 * printed on a Decree 439 paper, it answers with its copy of that paper.
 *
 * It states facts and returns no verdict. Which lines of the paper agree with
 * the copy, and whether the body that issued it could issue a paper of that
 * kind, are the domain's rules, applied by the stage that asked — the same
 * division the archive register keeps (ADR-0009, ADR-0028).
 *
 * An archive that cannot be reached throws; the stage is abandoned for that
 * paper and the report says it was not confirmed.
 */
export abstract class NationalArchivePort {
  abstract lookupByQr(qrReference: string): Promise<ArchiveQrAnswer>;
}
