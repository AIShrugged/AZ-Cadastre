import type { IssuingAuthorityKind } from '../../../domain/value-objects/index.js';

/**
 * What the issuer of a QR code says about the sheet that prints it, as opposed
 * to about what the sheet says (ADR-0034).
 *
 * This is what the archive's electronic document service actually answers
 * today: not the paper's contents but its provenance — who signed the
 * electronic original, for which body, and whether that signature still
 * verifies. It is evidence of a different kind and not a lesser one; a sheet
 * whose signature verifies is a sheet nobody has altered.
 */
export type ArchivedSignature = {
  signedBy: string | null;
  organisation: string | null;
  // The section of that body the signer belongs to, where the service names it.
  unit: string | null;
  signedOn: string | null;
  // Never null: a service that cannot say whether a signature verifies has said
  // nothing about the sheet, and answers with no signature block at all.
  valid: boolean;
};

/**
 * The archive's copy of one paper, as it states it. Each line is the archive's
 * own value, null where its entry gives none; the issuing body is named and
 * typed, because the kind of body a fund was created by is a fact the archive
 * keeps about its holdings (ADR-0028).
 */
export type ArchivedDocument = {
  documentNo: string | null;
  issuedOn: string | null;
  /*
   * The body the archive files the paper under, named and typed — null from a
   * service that says nothing about who issued the paper (ADR-0034).
   *
   * Null and not a stand-in value, because this is what competence is judged
   * on. A signature service names the office that attested the copy, and
   * offering that here would have the archive's own Baku branch judged on
   * whether it could allot land in 1998.
   */
  issuingAuthority: {
    name: string;
    kind: IssuingAuthorityKind;
  } | null;
  holderName: string | null;
  propertyAddress: string | null;
  plotArea: string | null;
  decreeItem: string | null;
  // Fond, inventory, file and sheet, in the archive's own words.
  archiveReference: string | null;
  // What the issuer says about the sheet itself. Null from a service that holds
  // records and does not verify signatures — which is what an archive with a
  // holdings API would be (ADR-0034).
  signature: ArchivedSignature | null;
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
    }
  /*
   * The reference is not one this archive issues, so it was never asked
   * (ADR-0034).
   *
   * A package carries codes from several services — the register prints one
   * that resolves in e-emlak, a notarial deed one that resolves in notariat.az
   * — and answering `NotFound` for those would say the archive looked and found
   * nothing, which is a claim about the paper nobody made. `issuer` is whoever
   * the reference names, so the report can say which system would have to be
   * connected for this sheet to be confirmed.
   */
  | {
      outcome: 'NotRecognised';
      issuer: string | null;
      note: string;
    };

/**
 * The National Archive Fund, as this context needs it: asked by the QR
 * reference decoded off a paper, it answers with what it holds under it.
 *
 * It states facts and returns no verdict. Which lines of the paper agree with
 * the copy, whether the body that issued it could issue a paper of that kind,
 * and what a verified signature is worth are the domain's rules, applied by the
 * stage that asked — the same division the archive register keeps (ADR-0009,
 * ADR-0028).
 *
 * An archive that cannot be reached throws; the stage is abandoned for that
 * paper and the report says it was not confirmed.
 */
export abstract class NationalArchivePort {
  abstract lookupByQr(qrReference: string): Promise<ArchiveQrAnswer>;
}
