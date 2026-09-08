import { describe, expect, it } from 'vitest';

import {
  InvalidApprovalCommentException,
  InvalidApprovalSummaryException,
} from '../exceptions/index.js';

import {
  ApprovalComment,
  ApprovalSummary,
  ApprovedCheck,
  ArchiveSearchApproval,
} from './archive-search-approval.vo.js';
import { RegistryCheckKey } from './registry-check.vo.js';
import { RegistryOutcome } from './registry-outcome.vo.js';

describe('ApprovalSummary', () => {
  it('keeps what the person wrote, without the spaces around it', () => {
    const summary = ApprovalSummary.create(
      '  The archive holds the original; nothing stands against the case.  ',
    );

    expect(summary.value).toBe(
      'The archive holds the original; nothing stands against the case.',
    );
  });

  /*
   * The one required part of an approval, and required because of what an
   * approval here is not: it names nobody, so an approval carrying only a
   * timestamp would say a search was signed for and nothing about what signing
   * it meant (ADR-0016).
   */
  it('refuses an approval that concludes nothing', () => {
    expect(() => ApprovalSummary.create('   ')).toThrow(
      InvalidApprovalSummaryException,
    );
  });

  it('refuses a summary that is the report rather than a conclusion', () => {
    expect(() =>
      ApprovalSummary.create('x'.repeat(ApprovalSummary.MAX_LENGTH + 1)),
    ).toThrow(InvalidApprovalSummaryException);
  });
});

describe('ApprovalComment', () => {
  it('keeps a remark, without the spaces around it', () => {
    expect(ApprovalComment.from('  folder 14 was re-checked  ')?.value).toBe(
      'folder 14 was re-checked',
    );
  });

  /*
   * Optional on purpose: a second box that has to be filled in beside the
   * summary is a box that gets "ok" typed into it, and a record full of "ok"
   * reads like deliberation without being any (ADR-0016). An untouched box
   * sends a blank, and a blank is no comment rather than an empty one.
   */
  it('reads a blank as no comment rather than as an empty one', () => {
    expect(ApprovalComment.from('   ')).toBeNull();
    expect(ApprovalComment.from(null)).toBeNull();
    expect(ApprovalComment.from(undefined)).toBeNull();
  });

  it('refuses a remark that is the report rather than a remark', () => {
    expect(() =>
      ApprovalComment.from('x'.repeat(ApprovalComment.MAX_LENGTH + 1)),
    ).toThrow(InvalidApprovalCommentException);
  });
});

describe('ArchiveSearchApproval', () => {
  // What was approved, and not merely that something was: an approval the
  // checks have since outrun is then readable rather than only marked spent.
  it('holds what the register had answered when it was signed for', () => {
    const approval = ArchiveSearchApproval.of({
      summary: ApprovalSummary.create('the record agrees on every attribute'),
      comment: null,
      checks: [
        ApprovedCheck.of(
          RegistryCheckKey.create('property_of_record'),
          RegistryOutcome.CONFIRMED,
        ),
      ],
    });

    expect(approval.checks).toHaveLength(1);
    expect(approval.checks[0]!.key.value).toBe('property_of_record');
    expect(approval.checks[0]!.outcome).toBe(RegistryOutcome.CONFIRMED);
    expect(approval.comment).toBeNull();
  });
});
