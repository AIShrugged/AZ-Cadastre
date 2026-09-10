/**
 * Trilingual UI (RU / EN / AZ) — a first-class product constraint, not an
 * afterthought. Every user-facing string lives here in all three languages,
 * including Cyrillic (RU) and Azerbaijani Latin (AZ). Layouts must tolerate
 * the length and script variance these produce.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Locale = 'en' | 'ru' | 'az';

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: 'az', label: 'Azərbaycan', short: 'AZ' },
  { id: 'ru', label: 'Русский', short: 'RU' },
  { id: 'en', label: 'English', short: 'EN' },
];

type Dict = Record<string, string>;

const en: Dict = {
  brand: 'Registry Operator',
  authority: 'Article 8 · Əmlak',
  'nav.workspace': 'Workspace',
  'search.placeholder': 'Search id, file, cadastral number, address, owner…',
  'search.label': 'Search the register',
  'density.label': 'Density',
  'density.comfortable': 'Comfortable',
  'density.compact': 'Compact',
  'col.documents': 'Documents',
  'col.submitted': 'Submitted',
  'col.status': 'Status',
  'status.ok': 'No issues',
  'status.issues': 'Issues found',
  'status.incomplete': 'Incomplete package',
  'status.failed': 'Verification failed',
  'filter.standing': 'Standing',
  'filter.any_standing': 'Any standing',
  'filter.outcome': 'Outcome',
  'filter.any_outcome': 'Any outcome',
  'findings.issues': '{n} issues',
  'findings.issue_one': '1 issue',
  'findings.low': '{n} low-confidence',
  'findings.none': 'None',
  'findings.noted': '{n} noted',
  'docs.count': '{d} of {r} required',
  'stage.progress': 'Stage {k} of {n}',
  'stage.1': 'OCR',
  'stage.2': 'Document detection',
  'stage.3': 'Classification',
  'stage.4': 'Field extraction',
  'stage.5': 'Cross-document check',
  'stage.6': 'Archive register',
  'stage.7': 'Completeness',
  'stage.8': 'Report',
  'empty.title': 'The register is empty',
  'empty.body':
    'Start a verification and the package will appear here with live progress.',
  'empty.filtered.title': 'No packages match',
  'empty.filtered.body':
    'No submission answers to this search and these filters. Clear them to see the whole register.',
  'empty.clear': 'Clear filters',
  'register.error.title': 'The register could not be read',
  'register.error.body':
    'The service did not answer, so how much the register holds is unknown — this is not an empty register. Ask it again.',
  'register.error.retry': 'Ask again',
  'page.showing': '{a}–{b} of {n}',
  // ── Register summary (the four slices of a period) ─────────────────────────
  'summary.title': 'Summary',
  'summary.period.label': 'Period',
  'summary.period.all': 'Whole register',
  'summary.period.last7': 'Last 7 days',
  'summary.period.last30': 'Last 30 days',
  'summary.period.month': 'This month',
  'summary.period.year': 'This year',
  'summary.empty': 'Nothing in this period',
  'summary.error.body':
    'The summary could not be read, so these numbers are unknown — this is not an empty register.',
  'summary.stalled.label': 'Stalled:',
  'summary.stalled.body':
    '— the machinery stopped, and waiting will not clear them.',
  'summary.stalled.open': 'Open stalled',
  'summary.stalled.none': 'Nothing has stalled.',
  'summary.pipeline.title': 'Where the work is',
  'summary.pipeline.note': 'Submissions accepted in this period: {n}.',
  'summary.pipeline.pending': 'Waiting to be read',
  'summary.pipeline.processing': 'Being read',
  'summary.pipeline.completed': 'Read',
  'summary.pipeline.failed': 'Stalled',
  'summary.outcomes.title': 'What the runs found',
  'summary.outcomes.note':
    'Submissions with a report: {n} of {total}. One still being read has no outcome yet.',
  'summary.outcomes.unlinked':
    'These counts open the register only over the whole register — the list cannot yet be narrowed to a period.',
  'summary.archive.title': 'What the archive answered',
  'summary.archive.note':
    'Questions put to the register: {n}. A profile may ask more than one about a submission.',
  'summary.archive.not_found_note':
    'The register answers about its own fonds. “No record” is a gap in the archive, not a fault in the submission.',
  'summary.against.title': 'Held against the package',
  'summary.against.note': 'Findings somebody has to resolve: {n}.',
  'summary.observations.title': 'Noted for the record',
  'summary.observations.note':
    'Observations: {n}. A report carrying nothing else still reads OK.',
  'summary.findings.none': 'None in this period.',
  'summary.findings.unseen': 'Kinds that did not occur in this period: {n}.',
  'page.prev': 'Previous',
  'page.next': 'Next',
  'updated.ago': 'updated {t} ago',
  open: 'Open',
  'profile.cadastre':
    'First state registration of an individual residential house',
  'upload.dropzone.title': 'Drop documents here',
  'upload.dropzone.body': 'PDF, JPG or PNG · up to {max} MB each',
  'upload.dropzone.browse': 'Browse files',
  'upload.drop_overlay': 'Drop files to add',
  'upload.uploaded': 'Uploaded',
  'upload.clear': 'Clear all',
  'upload.remove': 'Remove',
  'upload.reading_pages': 'Reading pages…',
  'upload.uploading': 'Uploading… {p}%',
  'upload.pages': '{n} pages',
  'upload.page_one': '1 page',
  'upload.err.format': 'Unsupported format — PDF, JPG or PNG only',
  'upload.err.size': 'Too large — {max} MB maximum',
  'upload.err.failed': 'Upload failed',
  'upload.files.none': 'No files added yet',
  'upload.files.all_label': 'files',
  'upload.files.uploading_label': 'uploaded',
  'doctype.land_plot_plan': 'Land parcel plan-scheme',
  'doctype.disposal_order': 'Order (or extract from the order)',
  'doctype.payment_receipt': 'Payment receipt',
  'doctype.sketch_project': 'Sketch design',
  'doctype.archive_certificate': 'Archival certificate',
  'doctype.application': 'Application',
  'doctype.identity_card': 'Identity document',
  'doctype.unknown': 'Unknown type',
  // The one answer left for a paper the statutory list does not name. The key
  // stays `out_of_profile` — every package already verified carries it — but
  // what the inspector reads is that the paper is not on the list, not that
  // this profile happens not to ask for it (ADR-0022).
  'doctype.out_of_profile': 'Other documents',
  // ── The document catalogue (ADR-0022) ──────────────────────────────────────
  // Every ground the law lets a right rest on, and not only the papers the
  // envelopes happened to carry: Article 8 of the State Register law, Decree
  // No. 439, the papers an application brings with it, and the registrar's own
  // service sheets. The names are the checklist's, shortened to what a table row
  // can hold — the legal wording in full is the classifier's business and stays
  // with the catalogue entry. A key the dictionary has no word for falls back to
  // the key itself (`translateOr`), so the catalogue may grow ahead of this list.
  // Grounds under Article 8 of the State Register law.
  'doctype.state_property_disposal_act':
    'Act on disposal of state or municipal immovable property',
  'doctype.auction_results_protocol': 'Auction results protocol',
  'doctype.notarised_property_contract':
    'Notarised contract on immovable property',
  'doctype.inheritance_certificate': 'Certificate of the right of inheritance',
  'doctype.spousal_share_certificate':
    'Certificate of ownership of a spousal share',
  'doctype.enforcement_sale_certificate':
    'Certificate on property under enforcement proceedings',
  'doctype.immovable_property_certificate': 'Immovable property certificate',
  'doctype.court_decision': 'Court decision in legal force',
  'doctype.registration_certificate': 'Registration certificate',
  'doctype.property_right_certificate':
    'Certificate of a right over immovable property',
  'doctype.housing_cooperative_allocation_decision':
    'Housing cooperative allocation decision',
  'doctype.garden_plot_allocation_document': 'Garden plot allocation document',
  'doctype.operation_acceptance_act': 'Act of acceptance into operation',
  'doctype.construction_permit_decision': 'Construction permit decision',
  'doctype.architectural_planning_section':
    'Architectural and planning section of the design',
  'doctype.operation_permit': 'Operation permit',
  'doctype.construction_completion_notice': 'Construction completion notice',
  'doctype.disaster_replacement_housing_list':
    'List of recipients of replacement housing',
  'doctype.state_housing_allocation_order': 'State housing allocation order',
  'doctype.privatisation_contract': 'Privatisation contract',
  'doctype.privatisation_consent_statement': 'Consent to privatisation',
  'doctype.housing_office_certificate':
    'Housing maintenance office certificate (form No. 2)',
  // Grounds under Decree No. 439 — rights that predate the register.
  'doctype.soviet_land_record': 'Soviet-era land record',
  'doctype.land_right_state_act': 'State act on a right over land',
  'doctype.temporary_land_use_certificate': 'Certificate of temporary land use',
  'doctype.land_allocation_decision': 'Land allocation decision',
  'doctype.notarised_building_right_contract':
    'Notarised contract on the right to build',
  'doctype.notarised_land_allocation_contract':
    'Notarised contract allotting a plot for a dwelling',
  'doctype.dwelling_transfer_decision':
    'Decision transferring a dwelling into ownership',
  'doctype.notarised_spousal_division_contract':
    'Notarised contract dividing a dwelling between spouses',
  'doctype.house_inventory_valuation_passport':
    'House inventory and valuation passport',
  'doctype.household_book_extract': 'Household book extract',
  'doctype.kolkhoz_allocation_decision': "Kolkhoz members' allocation decision",
  'doctype.sovkhoz_allocation_order': "Sovkhoz head's allocation order",
  'doctype.bound_land_book_extract': 'Bound land book extract',
  'doctype.cooperative_land_allocation_decision':
    'Land allocation decision for a cooperative',
  'doctype.homestead_land_allocation_decision':
    'Homestead land allocation decision',
  'doctype.apartment_demolition_decision': 'Apartment demolition decision',
  // Papers the application itself carries.
  'doctype.power_of_attorney': 'Power of attorney',
  'doctype.legal_entity_register_extract':
    'Extract from the register of legal entities',
  'doctype.technical_passport': 'Technical passport',
  'doctype.state_register_extract':
    'Extract from the State Register of Immovable Property',
  // The registrar's own service sheets.
  'doctype.registrar_routing_sheet': 'Registrar routing sheet',
  'doctype.expert_review_sheet': 'Examination sheet',
  'doctype.designer_licence': "Designer's licence",
  'doctype.valuation_contract': 'Valuation contract',
  'doctype.courier_waybill': 'Courier waybill',
  'doctype.covering_letter': 'Covering letter',
  'detail.ocr_pending': 'OCR pending…',
  'detail.classifying': 'Classifying…',
  'detail.splitting': 'Splitting into pages…',
  'detail.pages_read': '{n} of {total} pages read',
  'detail.unclassified': 'Not classified — no matching document type.',
  'detail.out_of_profile':
    'Read, and not one of the documents the statutory list names.',
  'detail.ocr_done': 'Text recognized',
  'detail.ocr_failed': 'OCR failed',
  'detail.view_text': 'View recognized text',
  'detail.no_fields': 'No fields extracted',
  // ── Verification details ────────────────────────────────────────────────────
  'detail.back': 'Back to register',
  'detail.action.cancel': 'Cancel verification',
  'detail.action.retry': 'Retry',
  'detail.action.rerun': 'Re-run',
  'detail.confirm_cancel': 'Stop this verification?',
  'toast.cancelled': 'Verification cancelled — {id}',
  'toast.restarted': 'Verification restarted — {id}',
  'detail.notfound.title': 'Package not found',
  'detail.notfound.body': 'This package is not in the register.',
  'detail.process': 'Verification process',
  'detail.stage_running': 'running…',
  'detail.in_progress_note':
    'Verification is running — this updates as each stage completes.',
  'detail.review_preparing': 'Review is being prepared',
  'detail.review_preparing_note':
    'The final checklist appears after classification, field extraction and comparisons finish.',
  'detail.review_unavailable':
    'A final report could not be prepared. Check the process state and the source documents.',
  'detail.review_focus': 'What to review',
  'detail.review_focus_note':
    'Start with the sections that show a non-zero count before making your decision.',
  'detail.focus_findings': 'Package findings',
  'detail.focus_comparisons': 'Document comparison',
  'detail.focus_archive': 'Archive comparison',
  'detail.focus_none': 'No action needed',
  'detail.focus_needs_review': '{n} need review',
  'detail.failed_note': 'Verification failed at {stage}.',
  'detail.report': 'Verification report',
  'detail.required': 'Required documents',
  'detail.required_all': 'Every required document was found.',
  'detail.required_missing': '{n} still missing',
  'detail.required_pending': 'Checked once classification finishes.',
  'detail.files': 'Files',
  'detail.files_count': '{n} files',
  'detail.file_one': '1 file',
  'detail.detecting': 'Detecting documents…',
  'detail.in_file_one': '1 document in this file',
  'detail.in_file': '{n} documents in this file',
  'detail.page_range': 'pp. {from}–{to}',
  'detail.page_single': 'p. {n}',
  'detail.documents': 'Documents',
  'detail.docs_count': '{d} of {r} documents',
  'detail.contents': 'Contents',
  'detail.source_text': 'Source text',
  'detail.handwritten': 'Handwritten',
  'detail.ocr': 'OCR',
  'detail.fields': 'Extracted fields',
  'detail.pending': 'Extraction pending',
  'detail.needs_review': 'Needs review',
  'detail.unscored': 'unscored',
  'detail.unscored_why':
    'Neither the model nor the route would say how sure it was, so no confidence was recorded. Check this reading against the sheet.',
  'detail.none': 'None',
  'detail.th.field': 'Field',
  'detail.th.value': 'Value',
  'detail.th.conf': 'Confidence',
  'detail.th.page': 'Page',
  'detail.page': 'Page {n}',
  'detail.sec.missing': 'Missing documents',
  'detail.sec.unreadable': 'Could not be read',
  'detail.sec.low': 'Low confidence',
  'detail.sec.duplicate': 'Answered twice',
  'detail.sec.mismatch': 'Documents disagree',
  'detail.sec.extra': 'Also in the package',
  'detail.sec.registry_mismatch': 'Disagrees with the archive record',
  'detail.sec.registry_document_missing': 'Original not in the archive',
  'detail.sec.registry_unconfirmed': 'Not confirmed by the register',
  'detail.sec.attestation': 'Stamp or signature missing',
  'detail.sec.supporting': 'Supporting documents to bring',
  'detail.sec.declared_mismatch': 'Differs from what was declared at intake',
  'detail.clean':
    'No issues found — every required document is present and read above the confidence threshold.',
  'detail.clean_open_set':
    'Which supporting documents this case needs, though, could not be worked out — see below.',
  'detail.f.missing_sub': 'Not found in the package',
  'detail.f.unplaced_sub': 'Type not recognized',
  'detail.f.unread_sheet_sub': 'Sheet could not be read',
  'detail.f.unread_file_sub': 'Not read into documents',
  'detail.f.low_sub': 'Below the confidence threshold',
  'detail.f.extra_sub': 'Not named by the statutory list of documents',
  'detail.f.extra_named_sub': '{type} — not a type this profile asks for',
  'detail.f.duplicate_sub': 'A second {type}',
  'detail.f.mismatch_sub': 'Does not agree across documents',
  'detail.f.unclear_sub': 'Could not be decided either way',
  'detail.f.registry_mismatch_sub': 'The archive record states otherwise',
  'detail.f.registry_document_missing_sub':
    'The archive keeps no original of this paper',
  'detail.f.registry_unconfirmed_sub': 'No record of it, or more than one',
  'detail.f.declared_sub': 'Disagrees with what was declared at intake',
  'detail.f.declared_year_sub': 'Declared at intake: {year}',
  'detail.declared_note':
    'Typed at the counter, from what the applicant said. Not a reading: it has no confidence and it is never merged with what the engine read off the papers.',
  'detail.f.attestation_sub': 'No stamp or signature was read on it',
  'supporting.lead':
    'Papers the applicant has to bring beyond the package. None of them was ever in the envelope, so nothing here is counted against the submission and nothing here is a fault.',
  'supporting.bring': 'The applicant must bring a set of supporting documents.',
  'supporting.placed':
    'Which set applies was worked out from the reading below.',
  'supporting.unplaced':
    'Which set applies could not be worked out from this package — the height or the year it turns on was not read off any of these papers. Settle it with the applicant before the registration is completed.',
  'supporting.defined_by':
    'The “{profile}” profile defines what each set contains. The papers themselves are not published to this screen yet.',
  'supporting.decided_on': 'Decided on',
  'detail.checks': 'Cross-document checks',
  'detail.checks_result': 'Document comparison results',
  'detail.checks_result_note':
    'Fields that the profile asks to compare across documents. Every value leads back to its source document and page.',
  'detail.checks_note':
    'Values the profile requires several documents to state alike.',
  'detail.checks_pending': 'Made once every document has been read.',
  'detail.checks_none':
    'No document comparisons were available for this package.',
  'detail.checks_agreed': '{n} of {total} agree',
  'detail.checks_go': 'Go to this reading in the register',
  'detail.check_agreed': 'Agree',
  'detail.check_disagreed': 'Disagree',
  'detail.check_unclear': 'Undecided',
  'check.applicant_identity': 'Applicant and identity document',
  'check.identity_document_no': 'Identity document number',
  'check.property_address': 'Property address',
  'check.cadastral_number': 'Cadastral number',
  'check.plot_area': 'Plot area',
  'check.property_of_record': 'The property against the archive record',
  // ─── The archive register ───────────────────────────────────────────────────
  'detail.registry': 'Archive register',
  'detail.archive_comparison': 'Comparison with archive',
  'detail.registry_note':
    'What the papers say about the property, held against the archive record of it. The only check that leaves the submission.',
  'detail.registry_pending': 'Asked once the property address has been read.',
  'detail.registry_none':
    'The register gave no answer for this package — either the address it asks about could not be read, or it could not be reached. Neither stops a run.',
  'detail.registry_asked': 'Asked about',
  'detail.registry_where': 'In the archive',
  'detail.reg.confirmed': 'Record agrees',
  'detail.reg.differs': 'Record disagrees',
  'detail.reg.incomplete': 'Original not in the archive',
  'detail.reg.not_found': 'No record',
  'detail.reg.ambiguous': 'Several records',
  'detail.reg.confirmed_note':
    'The record was found and everything held against it agreed. This is the lookup you do not have to make.',
  'detail.reg.differs_note':
    'The record was found and states something else. It is the record that disagrees, not the papers with each other.',
  'detail.reg.incomplete_note':
    'The record was found and agrees with the package. What the archive does not have is the original of one of the papers below \u2014 which, for a title relied on under Decree 439, is a condition of the ground and not a formality.',
  'detail.reg.not_found_note':
    'The register holds nothing under this address. Its coverage is the privatisations of the 1990s and 2000s, so an absent record says nothing about this package.',
  'detail.reg.ambiguous_note':
    'More than one record answers to this address. Which of them applies is yours to say, not the engine\u2019s.',
  'detail.reg.submitted': 'In the package',
  'detail.reg.recorded': 'On record',
  'detail.reg.silent': 'the register never held this column',
  'detail.reg.papers': 'Papers in the archive',
  'detail.reg.holding_held': 'The archive holds the original',
  'detail.reg.holding_notheld': 'The archive has no original of it',
  'detail.reg.holding_unknown':
    'the archive of this area never recorded papers of this kind',
  'regattr.ownerName': 'Right holder',
  'regattr.cadastralNumber': 'Cadastral number',
  'regattr.plotArea': 'Plot area',
  // ─── Triage ─────────────────────────────────────────────────────────────────
  // The worklist that leads the surface, the segments that filter the register,
  // and the lines that stand in for what has been folded away.
  'detail.attention': 'Needs attention',
  'detail.attention_go': 'Go to this reading in the register',
  'detail.observations': 'Observations',
  'detail.observations_note':
    'Neither is a shortfall — the package simply carries more than the profile asks for.',
  'detail.seg.review': 'To review',
  'detail.seg.all': 'All',
  'detail.seg.other': 'Other',
  'detail.other_group': '{n} other documents',
  'detail.other_group_one': '1 other document',
  'detail.other_show': 'Show',
  'detail.empty_filter': 'Nothing in this view.',
  'detail.process_done': 'Verification complete',
  'detail.stages_done': '{n} stages',
  'detail.required_found': '{n} of {total}',
  'detail.sheets': 'Sheets',
  'detail.contents_rest': '{n} more',
  'field.document_no': 'Document number',
  'field.expiry_date': 'Expiration date',
  'field.applicant_document_no': 'Applicant document number',
  'field.property_address': 'Property address',
  'field.cadastral_number': 'Cadastral number',
  'field.application_date': 'Application date',
  'field.project_name': 'Project name',
  'field.designer_name': 'Design organisation',
  'field.total_area': 'Total area',
  'field.approval_date': 'Approval date',
  // The figure the supporting-documents branch turns on. The sketch design
  // gained it with that branch (ADR-0013); a dictionary that had not been
  // taught it prints the raw key at the reader.
  'field.building_height': 'Building height',
  'field.issuing_authority': 'Issuing authority',
  'field.plot_area': 'Plot area',
  'field.plan_date': 'Plan date',
  'field.order_no': 'Order number',
  'field.receipt_no': 'Receipt number',
  'field.payer_name': 'Payer name',
  'field.amount': 'Amount paid',
  'field.payment_date': 'Payment date',
  'field.payment_purpose': 'Payment purpose',
  'field.storeys': 'Storeys',
  'field.certificate_no': 'Certificate number',
  'field.first_name': 'First name',
  'field.last_name': 'Last name',
  'field.applicant_name': 'Applicant name',
  'field.owner_name': 'Owner name',
  'field.issue_date': 'Issue date',
  // ── Archive register import (ADR-0011) ─────────────────────────────────────
  'reg.import.action': 'Load register file',
  'reg.import.title': 'Load archive register records',
  'reg.import.subtitle':
    'An .xlsx workbook: the register’s own template, one sheet per model, or one of the archive’s own registers, which the register recognises for itself. It stores every object it can read and reports the rest.',
  'reg.import.no_file': 'No workbook chosen',
  'reg.import.choose': 'Choose workbook',
  'reg.import.change': 'Change',
  'reg.import.send': 'Load',
  'reg.import.again': 'Load again',
  'reg.import.cancel': 'Cancel',
  'reg.import.close': 'Close',
  'reg.import.sending': 'Sending… {p}%',
  'reg.import.reading': 'The register is reading the workbook…',
  'reg.import.src.template':
    'Read as the register’s own import template — the only workbook with an “Objects” sheet.',
  'reg.import.src.register': 'Recognised as {file}.',
  'reg.import.src.by.sheets': 'By its sheet names.',
  'reg.import.src.by.fingerprint': 'By the register’s own rule:',
  'reg.import.src.by.model': 'By the model:',
  'reg.import.accepted': 'The register stored every object in the file.',
  'reg.import.partial':
    'The register stored what it could read and refused {n} objects — each one is below.',
  'reg.import.imported': 'Imported',
  'reg.import.refused': 'Refused',
  'reg.import.rows.addresses': 'Addresses',
  'reg.import.rows.rightHolders': 'Right holders',
  'reg.import.rows.documents': 'Documents',
  'reg.import.rows.aliases': 'Aliases',
  'reg.import.rows.locations': 'Locations',
  'reg.import.col.sheet': 'Sheet',
  'reg.import.col.row': 'Row',
  'reg.import.col.column': 'Column',
  'reg.import.col.message': 'What is wrong',
  'reg.import.err.format': 'The register loads .xlsx workbooks — choose one.',
  'reg.import.err.size':
    'The workbook is over {max} MB, which is the register’s ceiling.',
  'reg.import.err.unreachable':
    'The register did not answer. Check that it is running and try again.',
  'lang.label': 'Language',
  'theme.label': 'Appearance',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.to_light': 'Switch to light',
  'theme.to_dark': 'Switch to dark',
  'sidebar.toggle': 'Toggle sidebar',
  // ─── Refusals ───────────────────────────────────────────────────────────────
  // Keyed on the stable `code` the service answers a refused rule with, never on
  // its message (written for a log) or its status (which cannot tell two rules
  // apart). A code with no entry here falls back to the caller's generic line.
  // ─── Where the submission stands ───────────────────────────────────────────
  // Package Standing (ADR-0014): the third of the three states a reader will
  // call a status, and the only one written for the inspector. The pipeline's
  // own status and the report's are the machine's words and never reach a
  // person, which is why neither has a line in this dictionary.
  'detail.standing': 'Where it stands',
  'standing.Queued': 'Queued',
  'standing.UnderVerification': 'Being verified',
  'standing.Stalled': 'Stalled',
  'standing.ShortOfDocuments': 'Short of documents',
  'standing.NeedsInspector': 'Needs the inspector',
  'standing.AwaitingArchiveApproval': 'Archive search unapproved',
  'standing.Cleared': 'Nothing outstanding',
  'standing.note.Queued': 'Accepted. No run has read it yet.',
  'standing.note.UnderVerification':
    'A run is reading the package — this page updates as each stage finishes.',
  'standing.note.Stalled':
    'Our own machinery broke down, so nothing was concluded about the papers. Adding a file starts a fresh run.',
  'standing.note.ShortOfDocuments':
    'A paper this profile requires never arrived. Add it below and the package is verified afresh.',
  'standing.note.NeedsInspector':
    'The set is complete and the run holds findings against it — every one of them for you to resolve.',
  'standing.note.AwaitingArchiveApproval':
    'Nothing is held against it. The archive search it rests on has not been approved by anybody yet.',
  'standing.note.Cleared':
    'Nothing is held against it and nothing is outstanding. The registration decision is still yours.',
  // ─── Adding files to a package that already exists (ADR-0013) ──────────────
  'add.title': 'Add documents',
  'add.action': 'Add documents',
  'add.note':
    'The paper that never arrived, or a readable scan of a sheet nobody could read. Every file added is verified with the package.',
  'add.note_reopens':
    'Adding a file re-opens this package: the report, the document comparisons and the archive answers were all made over a set that has since changed, so they are discarded and the package is verified afresh. What was read off each file stays.',
  'add.closed_running':
    'A run is under way, so this package takes no files right now — a run reads the set it started with. Add them once it finishes.',
  'add.none': 'No files added yet',
  'add.uploading': 'Uploading…',
  'add.ready': '{n} ready to add',
  'add.send': 'Add to package',
  'add.sending': 'Adding…',
  'add.done': '{n} added — the package is being verified afresh',
  'add.failed': 'The files could not be added — please try again',
  'error.UNKNOWN_PROFILE':
    'That verification profile no longer exists — reload and pick again',
  'error.LEGAL_BASIS_NOT_IN_PROFILE':
    'The declared ground is not one this profile registers a right on — change the ground or the profile',
  'error.PACKAGE_MUST_HAVE_A_DOCUMENT': 'A package needs at least one document',
  'error.UNSUPPORTED_CONTENT_TYPE': 'Unsupported format — PDF, JPG or PNG only',
  'error.INVALID_FILENAME':
    'That filename cannot be stored — rename the file and retry',
  'error.INVALID_STORAGE_KEY':
    'The upload could not be located — remove the file and add it again',
  'error.CONCURRENCY_CONFLICT':
    'The package changed while you were working — reload and retry',
  'error.STORAGE_UNREACHABLE':
    'Document storage is unreachable — try again shortly',
  'error.OBJECT_BODY_MISSING': 'The uploaded file arrived empty — add it again',
  'error.RATE_LIMITED': 'Too many requests — try again shortly',
  'error.PACKAGE_NOT_TAKING_FILES':
    'A run is under way — files can be added once it finishes',
  'error.PACKAGE_MUST_GAIN_A_FILE': 'Choose at least one file to add',
  'error.PACKAGE_NOT_FOUND': 'This package is no longer in the register',
  'error.DUPLICATE_STORAGE_KEY': 'That file is already in the package',
  // ─── Approving the archive search (ADR-0016) ───────────────────────────────
  // The one write on the detail page a person makes rather than the engine.
  // Nothing in this block names an author, because there is none to name.
  'approve.title': 'Approval of the archive search',
  'approve.note':
    'What the register answered is above. What it means for this application is yours to say — approving records that conclusion, over the answers as they stand now.',
  'approve.no_author':
    'This system keeps no accounts, so an approval carries no name — only what was concluded and when. It is recorded as the office\u2019s, not as anybody\u2019s in particular.',
  'approve.summary_label': 'Conclusion for the application',
  'approve.summary_hint':
    'What the archive search means for this application as a whole — not for one lookup, which already says what it found. Required: an approval that records only that it happened records nothing.',
  'approve.summary_placeholder':
    'The record does not contradict the submission; the missing original does not bear on the right claimed…',
  'approve.comment_label': 'Remark (optional)',
  'approve.comment_hint':
    'A reservation, or why this was signed for despite something. Leave it empty when you have none — an empty remark is better than a filled-in one that says nothing.',
  'approve.comment_placeholder': 'A reservation, if you have one…',
  'approve.left': '{n} characters left',
  'approve.over': '{n} characters over',
  'approve.action': 'Approve the search',
  'approve.sending': 'Recording…',
  'approve.done': 'The archive search is approved',
  'approve.failed': 'The approval could not be recorded — please try again',
  'approve.given': 'Approved',
  'approve.remark': 'Remark',
  'approve.covered': 'Signed over these answers',
  'approve.now': 'now',
  'approve.gone': 'no longer asked',
  'approve.spent_since': 'stopped counting {d}',
  'approve.spent_title': 'Earlier approvals ({n})',
  'approve.spent_note':
    'The archive was searched again after these were signed, so they stopped counting. They are kept rather than removed: what was signed for, and over which answers, is part of the record.',
  'approve.unsettled':
    'A run is under way, so the register may still answer differently. The search can be approved once it finishes.',
  'approve.not_asked':
    'The register was asked nothing about this submission — its profile asks it nothing, or no sheet stated an address to ask about. There is no archive search to approve.',
  'error.ARCHIVE_SEARCH_NOT_SETTLED':
    'A run is under way — the search can be approved once it finishes',
  'error.ARCHIVE_SEARCH_NOT_ASKED':
    'The register was asked nothing about this submission',
  'error.ARCHIVE_SEARCH_ALREADY_APPROVED':
    'This archive search has already been approved — reload to see it',

  // ── The workspace shell ────────────────────────────────────────────────────
  'nav.intake': 'Case pre-check',
  'nav.search': 'Archive search',
  'nav.cases': 'Cases',
  'archive.data': 'Archive data',
  'archive.reach.asking': 'Asking the archive…',
  'archive.reach.answering': 'The archive is answering',
  'archive.reach.silent': 'The archive is not answering',
  // Label and figure rather than "5 sources": one string, three languages and
  // no grammatical number to agree with, which is what a count printed into a
  // sentence would demand of every locale for the sake of a plural nobody
  // reads at this size.
  'archive.holdings.sources': 'Sources: {n}',
  'archive.holdings.records': 'Records: {n}',
  'archive.holdings.loaded': 'Last loaded {date}',
  'archive.holdings.never': 'Nothing loaded yet',
  // A source the archive keeps and has loaded nothing from. Not "0": a zero in
  // a column of counts reads as a source that was counted and came out empty,
  // which is the same thing said less clearly.
  'archive.holdings.nothing': 'not loaded',

  // ── Archive search ─────────────────────────────────────────────────────────
  'page.search.title': 'Archive search',
  'page.search.subtitle':
    'Ask the archive register what it holds about a property — before the packet is taken in.',
  'search.field.address': 'Address',
  'search.field.address_hint':
    'Searched by. A record answers to every spelling its office ever wrote down, so an old address finds it too.',
  'search.field.address_placeholder': 'Address or village',
  'search.field.name': 'Applicant name',
  'search.field.name_hint':
    'Searched by. A name transliterated differently still finds the record; how far apart they are is in the confidence.',
  'search.field.name_placeholder': 'Surname, name, patronymic',
  'search.field.parcel': 'Parcel / cadastral no.',
  'search.field.parcel_hint':
    'Searched by, as far as it is known. Half a number is a question the register can answer.',
  'search.field.parcel_placeholder': 'Parcel, registry, certificate',
  'search.any_criterion':
    'Any one of the three finds records; together they narrow the search rather than widen it.',
  'search.note':
    'The register states what its own fonds hold and passes judgement on no application. Its coverage is partial and historical.',
  'search.submit': 'Search the archive',
  'search.searching': 'Searching…',
  // ── The bar the operator sets, in the contract's own four bands ────────────
  'search.threshold.label': 'Show no weaker than',
  'search.band.high': 'High',
  'search.band.probable': 'Probable',
  'search.band.possible': 'Possible',
  'search.band.weak': 'Weak',
  // ── What came back ────────────────────────────────────────────────────────
  // Label and figure rather than a sentence with a count in it: three
  // languages, and no grammatical number for a plural nobody reads at this
  // size.
  'search.matched': 'Matches: {n}',
  'search.considered': 'Records compared: {n}.',
  'search.at_threshold': 'Offered from {band} ({value}) up.',
  'search.sources': 'Sources that answered',
  'search.panel.matches': 'Records the archive offers',
  'search.silent_about':
    'The source keeps no column for: {fields}. Silence, counted neither for nor against.',
  'search.disputed': 'Sources differ',
  'search.panel.disagreements': 'Where the sources differ',
  'search.disagreements.note':
    'Two registers answer for the same property and record it differently. The register quotes both and settles neither — somebody who can open the folder does that.',
  'search.more':
    'Showing the surest {shown} of {n}. Narrow the question to reach the rest.',
  'search.idle.title': 'Nothing asked yet',
  'search.idle.body':
    'Enter whatever you have — an address, a name, a parcel number — and the register will offer the records that might be it.',
  'search.none.title': 'The archive offers nothing here',
  'search.none.body':
    'Nothing the register compared reaches the level asked for. Its coverage is partial and historical, so this says nothing about the property — lower the level, or search by less of what you know.',
  'search.error.title': 'The archive did not answer',
  'search.error.body':
    'The register could not be reached. Try the search again.',
  'search.footer':
    'The archive is several registers, kept by different offices over thirty years. About what none of them holds, it says nothing.',
  'archive.found': 'Record found',
  'archive.found_note': 'The register holds a record under this address.',
  'archive.not_found': 'No record',
  'archive.not_found_note':
    'The register holds nothing under this address. Its coverage is partial and historical, so this says nothing about the property.',
  'archive.ambiguous': 'More than one record',
  'archive.ambiguous_note':
    'More than one record answers to this address. Somebody has to say which of them applies.',
  'archive.canonical': 'Address as recorded:',
  'archive.candidates': 'Records answering to the address: {n}',
  'archive.vs': 'in the record',
  'archive.location': 'Archive location',
  'archive.location.value': 'folder {folder}, pages {pages}',
  'archive.panel.record': 'The record',
  'archive.panel.attributes': 'Held against the record',
  'archive.panel.documents': 'Papers the archive keeps',
  'archive.panel.source': 'Source',
  'archive.source.register': 'Archive register',
  'archive.field.register_no': 'Register no.',
  'archive.field.inventory_no': 'Inventory no.',
  'archive.field.address': 'Address',
  'archive.field.owner_name': 'Owner',
  'archive.field.cadastral_number': 'Cadastral number',
  'archive.field.plot_area': 'Plot area',
  'archive.match.matches': 'Agrees',
  'archive.match.differs': 'Differs',
  'archive.match.not_recorded': 'Not recorded',
  'archive.holding.held': 'In the archive',
  'archive.holding.not_held': 'Not in the archive',
  'archive.holding.unknown': 'Not recorded',

  // ── Case pre-check ─────────────────────────────────────────────────────────
  'page.intake.title': 'Case pre-check',
  'page.intake.subtitle':
    'Add the packet; the system reads it, checks it and reports what it found. You decide.',
  'intake.step.add': 'Add the packet',
  'intake.step.read': 'We read it',
  'intake.step.result': 'Result',
  'intake.field.profile': 'Verification profile',
  'intake.profile.docs': '{n} required documents',
  'intake.start': 'Run the pre-check',
  'intake.starting': 'Starting…',
  'intake.failed': 'The case could not be opened — please try again',
  'intake.saved': 'Saved as case',
  'intake.another': 'Take another packet',
  'intake.open_case': 'Open the case',
  'intake.recommendation': 'Recommendation',
  'intake.read.title': 'What we read from the packet',
  'intake.read.lead':
    'The applicant, the address and the parcel are read from the documents themselves. A reading the engine was unsure of is marked — check it against the papers on the case sheet.',
  'intake.read.filling': 'fills itself',
  'intake.read.reading': 'being read…',
  'intake.read.unread': 'not read from the packet',
  'intake.read.glance': 'read at {p}% — worth a second look',
  'intake.read.applicant': 'Applicant',
  'intake.read.address': 'Address',
  'intake.read.parcel': 'Parcel / registry no.',
  'intake.group.documents': 'Documents',
  'intake.group.legal': 'Legal ground',
  'intake.group.legal_none':
    'The run named no set of supporting documents for this case.',
  'intake.group.archive': 'Archive',
  'intake.group.archive_none':
    'The archive register was not asked about this case.',
  'intake.group.nothing': 'Nothing is held against the packet here.',
  // ── What the office declares at the counter ────────────────────────────────
  // Not a reading and never a correction to one: the operator says what the
  // claim is founded on and what year the building is said to date from, and
  // the engine reads the papers separately. Both optional, in every language.
  'declared.title': 'Declared at intake',
  'declared.basis': 'What the right is founded on',
  'declared.year': 'Year built',
  'declared.not_declared': 'Not declared',
  'intake.profile.unchosen':
    'Choose a verification profile — the packet is filed under the one you pick, and nothing picks it for you.',
  'intake.declared.lead':
    'Optional, and taken from what the applicant says — not from the documents. It suggests a profile and is kept apart from what the engine reads.',
  'intake.declared.basis_hint':
    'The paper the claimed right rests on, from those this profile registers a right on.',
  'intake.declared.basis_stray':
    '“{ground}” is not a ground the {profile} profile registers a right on — choose another ground, or another profile.',
  'intake.declared.year_hint':
    'Four digits, {from}–{to}. Leave empty if unknown.',
  'intake.declared.year_placeholder': 'e.g. 1998',
  'intake.declared.year_outside':
    'A year is read between {from} and {to} — this one will not be taken.',
  'intake.suggest.title': 'Suggested profile',
  'intake.suggest.undeclared':
    'Declare a ground or a year and the profile it points at is suggested here.',
  'intake.suggest.take': 'Choose this profile',
  'intake.suggest.chosen': 'chosen',
  'intake.suggest.asking': 'asking again…',
  'intake.suggest.none':
    'None — the declaration does not point at one profile. Why is written under the field it is about.',
  'intake.suggest.unavailable':
    'Not available just now. It only ever recommends — choose the profile yourself, as always.',
  // The suggestion's reasoning, one line per figure, said beside the figure it
  // is about. The English audit line the answer carries is for the record and
  // is never shown.
  'suggest.basis.none':
    'Not declared. Which paper a right is founded on is what tells one profile from another, so none is suggested until one is.',
  'suggest.basis.unregistered':
    'No profile registers a right founded on “{ground}”.',
  'suggest.basis.several':
    'More than one profile registers a right founded on “{ground}” — {profiles}. Which of them this case is, the declaration does not say.',
  'suggest.basis.only':
    '“{ground}” is a ground the {profile} profile registers a right on, and the only profile that does.',
  'suggest.year.moot':
    'No profile is selected by the ground, so there is nothing here to narrow.',
  'suggest.year.any':
    'Not declared, and not needed: {profile} answers for any year.',
  'suggest.year.leaves': '{year} leaves {profile}.',
  'suggest.year.awaited':
    'Not declared — {profile} answers for a period, so without a year it can be neither ruled in nor out.',
  'suggest.year.undeclared': 'Not declared.',
  'suggest.year.rules_out':
    '{year} rules out {profile}, which is the only profile this ground points at.',
  'suggest.year.no_narrower': '{year} does not narrow this to one profile.',

  // ── Cases ──────────────────────────────────────────────────────────────────
  'page.cases.title': 'Cases',
  'page.cases.subtitle':
    'Applications, document completeness and verification remarks in one register.',
  'action.intake': 'Case pre-check',
  'col.case': 'Case',
  'col.applicant': 'Applicant / Address',
  // Both filters over this table narrow into this one column, so its heading
  // names both — the inspector who set "Outcome" has to see where the answer
  // landed.
  'col.state': 'Standing & outcome',
  'slice.label': 'Case views',
  'slice.all': 'All',
  'slice.processing': 'Processing',
  'slice.remarks': 'Remarks',
  'slice.incomplete': 'Incomplete',
  'slice.clean': 'Clean',
  'slice.error': 'Error',
};

const ru: Dict = {
  brand: 'Оператор реестра',
  authority: 'Статья 8 · Əmlak',
  'nav.workspace': 'Рабочая область',
  'search.placeholder': 'Номер, файл, кадастровый номер, адрес, собственник…',
  'search.label': 'Поиск по реестру',
  'density.label': 'Плотность',
  'density.comfortable': 'Свободно',
  'density.compact': 'Компактно',
  'col.documents': 'Документы',
  'col.submitted': 'Подано',
  'col.status': 'Статус',
  'status.ok': 'Без замечаний',
  'status.issues': 'Найдены замечания',
  'status.incomplete': 'Неполный пакет',
  'status.failed': 'Проверка не удалась',
  'filter.standing': 'Состояние',
  'filter.any_standing': 'Любое состояние',
  'filter.outcome': 'Итог проверки',
  'filter.any_outcome': 'Любой итог',
  'findings.issues': '{n} замечаний',
  'findings.issue_one': '1 замечание',
  'findings.low': '{n} с низкой увер.',
  'findings.none': 'Нет',
  'findings.noted': 'отмечено: {n}',
  'docs.count': '{d} из {r} обязательных',
  'stage.progress': 'Этап {k} из {n}',
  'stage.1': 'OCR',
  'stage.2': 'Поиск документов',
  'stage.3': 'Классификация',
  'stage.4': 'Извлечение полей',
  'stage.5': 'Сверка документов',
  'stage.6': 'Архивный реестр',
  'stage.7': 'Комплектность',
  'stage.8': 'Отчёт',
  'empty.title': 'Реестр пуст',
  'empty.body': 'Запустите проверку — пакет появится здесь с ходом обработки.',
  'empty.filtered.title': 'Совпадений нет',
  'empty.filtered.body':
    'Под этот поиск и эти отборы не подходит ни одно заявление. Снимите их, чтобы увидеть весь реестр.',
  'empty.clear': 'Сбросить отбор',
  'register.error.title': 'Реестр не прочитан',
  'register.error.body':
    'Сервис не ответил, поэтому сколько в реестре заявлений — неизвестно; это не пустой реестр. Спросите ещё раз.',
  'register.error.retry': 'Спросить снова',
  'page.showing': '{a}–{b} из {n}',
  // ── Сводка по реестру (четыре среза периода) ───────────────────────────────
  'summary.title': 'Сводка',
  'summary.period.label': 'Период',
  'summary.period.all': 'Весь реестр',
  'summary.period.last7': 'Последние 7 дней',
  'summary.period.last30': 'Последние 30 дней',
  'summary.period.month': 'Текущий месяц',
  'summary.period.year': 'Текущий год',
  'summary.empty': 'За этот период ничего нет',
  'summary.error.body':
    'Сводку не удалось прочитать, поэтому цифры неизвестны — это не пустой реестр.',
  'summary.stalled.label': 'Остановилось:',
  'summary.stalled.body': '— сломался конвейер, ожидание их не сдвинет.',
  'summary.stalled.open': 'Открыть остановившиеся',
  'summary.stalled.none': 'Ничего не остановилось.',
  'summary.pipeline.title': 'Ход работы',
  'summary.pipeline.note': 'За этот период принято заявлений: {n}.',
  'summary.pipeline.pending': 'Ждут обработки',
  'summary.pipeline.processing': 'В работе',
  'summary.pipeline.completed': 'Обработаны',
  'summary.pipeline.failed': 'Остановились',
  'summary.outcomes.title': 'Итоги отчётов',
  'summary.outcomes.note':
    'Заявлений с отчётом: {n} из {total}. У того, что ещё читают, итога пока нет.',
  'summary.outcomes.unlinked':
    'Эти цифры открывают реестр только для всего реестра — список пока нельзя ограничить периодом.',
  'summary.archive.title': 'Ответы архивного реестра',
  'summary.archive.note':
    'Запросов к реестру: {n}. По одному заявлению профиль может задать несколько.',
  'summary.archive.not_found_note':
    'Реестр отвечает о своих фондах. «Не найдено» — пробел в архиве, а не изъян заявления.',
  'summary.against.title': 'Замечания к пакету',
  'summary.against.note': 'Замечаний, которые кому-то придётся снять: {n}.',
  'summary.observations.title': 'Отмечено для сведения',
  'summary.observations.note':
    'Наблюдений: {n}. Отчёт, где нет ничего другого, всё равно читается как «без замечаний».',
  'summary.findings.none': 'За этот период ничего.',
  'summary.findings.unseen': 'Видов, не встретившихся за этот период: {n}.',
  'page.prev': 'Назад',
  'page.next': 'Вперёд',
  'updated.ago': 'обновлено {t} назад',
  open: 'Открыть',
  'profile.cadastre':
    'Первичная государственная регистрация индивидуального жилого дома',
  'upload.dropzone.title': 'Перетащите документы сюда',
  'upload.dropzone.body': 'PDF, JPG или PNG · до {max} МБ каждый',
  'upload.dropzone.browse': 'Выбрать файлы',
  'upload.drop_overlay': 'Отпустите файлы для добавления',
  'upload.uploaded': 'Загружено',
  'upload.clear': 'Очистить всё',
  'upload.remove': 'Удалить',
  'upload.reading_pages': 'Чтение страниц…',
  'upload.uploading': 'Загрузка… {p}%',
  'upload.pages': '{n} стр.',
  'upload.page_one': '1 стр.',
  'upload.err.format': 'Неподдерживаемый формат — только PDF, JPG или PNG',
  'upload.err.size': 'Слишком большой — максимум {max} МБ',
  'upload.err.failed': 'Ошибка загрузки',
  'upload.files.none': 'Файлы ещё не добавлены',
  'upload.files.all_label': 'файлов',
  'upload.files.uploading_label': 'загружено',
  'doctype.land_plot_plan': 'План-схема земельного участка',
  'doctype.disposal_order': 'Распоряжение (или выписка из распоряжения)',
  'doctype.payment_receipt': 'Квитанция об оплате',
  'doctype.sketch_project': 'Эскизный проект',
  'doctype.archive_certificate': 'Архивная справка',
  'doctype.application': 'Заявление',
  'doctype.identity_card': 'Документ, удостоверяющий личность',
  'doctype.unknown': 'Неизвестный тип',
  // Единственный ответ, оставшийся для бумаги, которую законный перечень не
  // называет. Ключ остаётся `out_of_profile` — он лежит в базе у всех уже
  // проверенных пакетов, — но инспектор читает, что бумаги нет в перечне, а не
  // что её не спрашивает этот профиль (ADR-0022).
  'doctype.out_of_profile': 'Прочие документы',
  // ── Справочник документов (ADR-0022) ───────────────────────────────────────
  // Весь законный перечень оснований, а не только бумаги, попадавшиеся в
  // конвертах: статья 8 Закона о государственном реестре, Указ № 439, бумаги
  // самого заявления и служебные листы регистратора. Названия — из чек-листа,
  // укороченные до того, что помещается в строку таблицы; полная юридическая
  // формулировка — дело классификатора и лежит в записи справочника. Ключ, для
  // которого здесь слова нет, показывается сам собой (`translateOr`), так что
  // справочник может расти быстрее этого списка.
  // Основания по статье 8 Закона о государственном реестре.
  'doctype.state_property_disposal_act':
    'Акт об отчуждении государственного или муниципального имущества',
  'doctype.auction_results_protocol': 'Протокол о результатах аукциона',
  'doctype.notarised_property_contract':
    'Нотариально удостоверенный договор в отношении недвижимости',
  'doctype.inheritance_certificate': 'Свидетельство о праве на наследство',
  'doctype.spousal_share_certificate':
    'Свидетельство о праве собственности на долю в общем имуществе супругов',
  'doctype.enforcement_sale_certificate':
    'Свидетельство об имуществе в связи с принудительным исполнением',
  'doctype.immovable_property_certificate': 'Сертификат недвижимого имущества',
  'doctype.court_decision': 'Решение суда, вступившее в законную силу',
  'doctype.registration_certificate': 'Регистрационное удостоверение',
  'doctype.property_right_certificate':
    'Свидетельство (акт) о праве на недвижимое имущество',
  'doctype.housing_cooperative_allocation_decision':
    'Решение общего собрания членов ЖСК о предоставлении помещения',
  'doctype.garden_plot_allocation_document': 'Документ на садовый участок',
  'doctype.operation_acceptance_act': 'Акт приёмки в эксплуатацию',
  'doctype.construction_permit_decision':
    'Решение о разрешении на строительство',
  'doctype.architectural_planning_section':
    'Архитектурно-планировочный раздел проекта',
  'doctype.operation_permit': 'Разрешение на эксплуатацию',
  'doctype.construction_completion_notice':
    'Уведомление о завершении строительства',
  'doctype.disaster_replacement_housing_list':
    'Список лиц, получивших жильё взамен разрушенного',
  'doctype.state_housing_allocation_order':
    'Ордер на жильё из государственного фонда',
  'doctype.privatisation_contract': 'Договор о приватизации',
  'doctype.privatisation_consent_statement':
    'Заявление о согласии на приватизацию',
  'doctype.housing_office_certificate': 'Справка ЖЭО (форма № 2)',
  // Основания по Указу № 439 — права, возникшие до реестра.
  'doctype.soviet_land_record':
    'Земельная запись исполкома местного совета (БТИ)',
  'doctype.land_right_state_act':
    'Государственный акт на право на земельный участок',
  'doctype.temporary_land_use_certificate':
    'Свидетельство о праве временного пользования землёй',
  'doctype.land_allocation_decision': 'Решение об отводе земельных участков',
  'doctype.notarised_building_right_contract':
    'Нотариально удостоверенный договор о праве застройки',
  'doctype.notarised_land_allocation_contract':
    'Нотариальный договор об отводе участка под жилой дом',
  'doctype.dwelling_transfer_decision':
    'Решение о передаче жилья в собственность',
  'doctype.notarised_spousal_division_contract':
    'Нотариальный договор о разделе жилого дома между супругами',
  'doctype.house_inventory_valuation_passport':
    'Паспорт инвентаризации и оценки дома',
  'doctype.household_book_extract': 'Выписка из похозяйственной книги',
  'doctype.kolkhoz_allocation_decision':
    'Решение общего собрания членов колхоза об отводе участка',
  'doctype.sovkhoz_allocation_order':
    'Приказ руководителя совхоза об отводе участка',
  'doctype.bound_land_book_extract':
    'Выписка из прошнурованной земельной книги',
  'doctype.cooperative_land_allocation_decision':
    'Решение об отводе участка кооперативу',
  'doctype.homestead_land_allocation_decision':
    'Решение об отводе приусадебного участка',
  'doctype.apartment_demolition_decision':
    'Решение о сносе квартир и строительстве индивидуального дома',
  // Бумаги самого заявления.
  'doctype.power_of_attorney': 'Доверенность',
  'doctype.legal_entity_register_extract':
    'Выписка из государственного реестра юридических лиц',
  'doctype.technical_passport': 'Технический паспорт',
  'doctype.state_register_extract':
    'Выписка из государственного реестра недвижимого имущества',
  // Служебные бумаги регистратора.
  'doctype.registrar_routing_sheet': 'Служебный обходной лист',
  'doctype.expert_review_sheet': 'Лист экспертизы',
  'doctype.designer_licence': 'Лицензия проектировщика',
  'doctype.valuation_contract': 'Договор оценки',
  'doctype.courier_waybill': 'Курьерская накладная',
  'doctype.covering_letter': 'Сопроводительное письмо',
  'detail.ocr_pending': 'OCR обрабатывается…',
  'detail.classifying': 'Классификация…',
  'detail.splitting': 'Разбивка на страницы…',
  'detail.pages_read': 'распознано {n} из {total} страниц',
  'detail.unclassified': 'Не классифицировано — тип документа не распознан.',
  'detail.out_of_profile':
    'Прочитан; в законном перечне документов такой бумаги нет.',
  'detail.ocr_done': 'Текст распознан',
  'detail.ocr_failed': 'Ошибка OCR',
  'detail.view_text': 'Показать распознанный текст',
  'detail.no_fields': 'Поля не извлечены',
  // ── Детали проверки ─────────────────────────────────────────────────────────
  'detail.back': 'Назад к реестру',
  'detail.action.cancel': 'Отменить проверку',
  'detail.action.retry': 'Повторить',
  'detail.action.rerun': 'Перезапустить',
  'detail.confirm_cancel': 'Остановить проверку?',
  'toast.cancelled': 'Проверка отменена — {id}',
  'toast.restarted': 'Проверка перезапущена — {id}',
  'detail.notfound.title': 'Пакет не найден',
  'detail.notfound.body': 'Этого пакета нет в реестре.',
  'detail.process': 'Процесс проверки',
  'detail.stage_running': 'выполняется…',
  'detail.in_progress_note':
    'Проверка идёт — обновляется по мере прохождения этапов.',
  'detail.review_preparing': 'Результаты проверки готовятся',
  'detail.review_preparing_note':
    'Итоговый список появится после классификации, извлечения полей и сверок.',
  'detail.review_unavailable':
    'Итоговый отчёт не удалось подготовить. Проверьте ход процесса и исходные документы.',
  'detail.review_focus': 'На что обратить внимание',
  'detail.review_focus_note':
    'Перед решением начните с разделов с ненулевым счётчиком.',
  'detail.focus_findings': 'Замечания по пакету',
  'detail.focus_comparisons': 'Сверка документов',
  'detail.focus_archive': 'Сравнение с архивом',
  'detail.focus_none': 'Действий не требуется',
  'detail.focus_needs_review': 'Требует проверки: {n}',
  'detail.failed_note': 'Проверка прервана на этапе «{stage}».',
  'detail.report': 'Отчёт проверки',
  'detail.required': 'Обязательные документы',
  'detail.required_all': 'Все обязательные документы найдены.',
  'detail.required_missing': 'не найдено: {n}',
  'detail.required_pending': 'Проверяется после завершения классификации.',
  'detail.files': 'Файлы',
  'detail.files_count': '{n} файлов',
  'detail.file_one': '1 файл',
  'detail.detecting': 'Поиск документов…',
  'detail.in_file_one': '1 документ в этом файле',
  'detail.in_file': 'документов в этом файле: {n}',
  'detail.page_range': 'стр. {from}–{to}',
  'detail.page_single': 'стр. {n}',
  'detail.documents': 'Документы',
  'detail.docs_count': '{d} из {r} документов',
  'detail.contents': 'Состав пакета',
  'detail.source_text': 'Исходный текст',
  'detail.handwritten': 'Рукописный',
  'detail.ocr': 'OCR',
  'detail.fields': 'Извлечённые поля',
  'detail.pending': 'Извлечение ожидается',
  'detail.needs_review': 'Требует проверки',
  'detail.unscored': 'без оценки',
  'detail.unscored_why':
    'Ни модель, ни маршрут не сообщили уверенность, поэтому она не записана. Сверьте это значение с листом.',
  'detail.none': 'Нет',
  'detail.th.field': 'Поле',
  'detail.th.value': 'Значение',
  'detail.th.conf': 'Увер.',
  'detail.th.page': 'Стр.',
  'detail.page': 'Стр. {n}',
  'detail.sec.missing': 'Отсутствующие документы',
  'detail.sec.unreadable': 'Не удалось распознать',
  'detail.sec.low': 'Низкая уверенность',
  'detail.sec.duplicate': 'Дублирующие документы',
  'detail.sec.mismatch': 'Документы расходятся',
  'detail.sec.extra': 'Прочее в пакете',
  'detail.sec.registry_mismatch': 'Расходится с архивной записью',
  'detail.sec.registry_document_missing': 'Подлинника нет в архиве',
  'detail.sec.registry_unconfirmed': 'Реестр не подтвердил',
  'detail.sec.attestation': 'Нет печати или подписи',
  'detail.sec.supporting': 'Какие документы нужно принести',
  'detail.sec.declared_mismatch': 'Расходится с заявленным при приёме',
  'detail.clean':
    'Замечаний нет — все обязательные документы присутствуют и распознаны выше порога уверенности.',
  'detail.clean_open_set':
    'Но какой комплект подтверждающих документов нужен по этому делу — определить не удалось, см. ниже.',
  'detail.f.missing_sub': 'Не найден в пакете',
  'detail.f.unplaced_sub': 'Тип не распознан',
  'detail.f.unread_sheet_sub': 'Лист не распознан',
  'detail.f.unread_file_sub': 'Не разобран на документы',
  'detail.f.low_sub': 'Ниже порога уверенности',
  'detail.f.extra_sub': 'Не входит в законный перечень документов',
  'detail.f.extra_named_sub': '{type} — профиль такого типа не требует',
  'detail.f.duplicate_sub': 'Второй документ: {type}',
  'detail.f.mismatch_sub': 'Документы расходятся',
  'detail.f.unclear_sub': 'Однозначно определить не удалось',
  'detail.f.registry_mismatch_sub': 'Архивная запись говорит другое',
  'detail.f.registry_document_missing_sub':
    'Подлинник этого документа в архиве не хранится',
  'detail.f.registry_unconfirmed_sub': 'Записи нет или их несколько',
  'detail.f.declared_sub': 'Расходится с заявленным при приёмке',
  'detail.f.declared_year_sub': 'Заявлено при приёмке: {year}',
  'detail.declared_note':
    'Записано на приёме со слов заявителя. Это не прочитанное: уверенности у него нет, и с тем, что движок прочитал в документах, оно не смешивается.',
  'detail.f.attestation_sub': 'Печать или подпись на нём не прочитаны',
  'supporting.lead':
    'Документы, которые заявитель должен принести дополнительно к пакету. Ни одного из них в пакете не было и быть не могло, поэтому ничто здесь не засчитывается пакету в минус и нарушением не является.',
  'supporting.bring':
    'Заявитель должен принести комплект подтверждающих документов.',
  'supporting.placed': 'Какой именно комплект — определено по показанию ниже.',
  'supporting.unplaced':
    'Какой именно комплект — по этому пакету определить не удалось: ни в одном из документов не прочитаны высота здания или год, от которых зависит выбор. Уточните комплект у заявителя до завершения регистрации.',
  'supporting.defined_by':
    'Состав комплектов задаёт профиль «{profile}». Сам перечень бумаг на этот экран пока не передаётся.',
  'supporting.decided_on': 'Определено по',
  'detail.checks': 'Сверка документов',
  'detail.checks_result': 'Результаты сверки документов',
  'detail.checks_result_note':
    'Поля, которые профиль требует сверить между документами. Каждое значение ведёт к исходному документу и листу.',
  'detail.checks_note':
    'Значения, которые по профилю должны совпадать в нескольких документах.',
  'detail.checks_pending': 'Выполняется после прочтения всех документов.',
  'detail.checks_none':
    'Для этого пакета нет доступных результатов сверки документов.',
  'detail.checks_agreed': 'совпадает: {n} из {total}',
  'detail.checks_go': 'Перейти к этому значению в реестре',
  'detail.check_agreed': 'Совпадает',
  'detail.check_disagreed': 'Расходится',
  'detail.check_unclear': 'Не определено',
  'check.applicant_identity': 'Заявитель и удостоверение личности',
  'check.identity_document_no': 'Номер удостоверения личности',
  'check.property_address': 'Адрес объекта',
  'check.cadastral_number': 'Кадастровый номер',
  'check.plot_area': 'Площадь участка',
  'check.property_of_record': 'Объект против архивной записи',
  // ─── Архивный реестр ────────────────────────────────────────────────────────
  'detail.registry': 'Архивный реестр',
  'detail.archive_comparison': 'Сравнение с архивом',
  'detail.registry_note':
    'Что документы говорят об объекте — против архивной записи о нём. Единственная проверка, которая выходит за пределы пакета.',
  'detail.registry_pending': 'Реестр спрашивают, когда прочитан адрес объекта.',
  'detail.registry_none':
    'Реестр не ответил по этому пакету: либо не прочитан адрес, о котором он спрашивает, либо до реестра не достучались. Ни то, ни другое не останавливает проверку.',
  'detail.registry_asked': 'Спрошено об адресе',
  'detail.registry_where': 'В архиве',
  'detail.reg.confirmed': 'Запись подтверждает',
  'detail.reg.differs': 'Запись расходится',
  'detail.reg.incomplete': 'Подлинника нет в архиве',
  'detail.reg.not_found': 'Записи нет',
  'detail.reg.ambiguous': 'Несколько записей',
  'detail.reg.confirmed_note':
    'Запись найдена, и всё, что с ней сверяли, совпало. Это та справка, которую вам не нужно наводить.',
  'detail.reg.differs_note':
    'Запись найдена и говорит другое. Расходится именно запись, а не документы между собой.',
  'detail.reg.incomplete_note':
    'Запись найдена и с пакетом сходится. Чего в архиве нет \u2014 так это подлинника одного из документов ниже; для основания по постановлению 439 это условие действительности, а не формальность.',
  'detail.reg.not_found_note':
    'По этому адресу реестр ничего не держит. Он покрывает приватизации 1990-х и 2000-х, поэтому отсутствие записи ничего не говорит о пакете.',
  'detail.reg.ambiguous_note':
    'Этому адресу отвечает больше одной записи. Какая из них та самая — решать вам, а не системе.',
  'detail.reg.submitted': 'В пакете',
  'detail.reg.recorded': 'В записи',
  'detail.reg.silent': 'такой графы в реестре не было',
  'detail.reg.papers': 'Документы в архиве',
  'detail.reg.holding_held': 'Подлинник в архиве есть',
  'detail.reg.holding_notheld': 'Подлинника в архиве нет',
  'detail.reg.holding_unknown':
    'архив этого района такие документы никогда не учитывал',
  'regattr.ownerName': 'Правообладатель',
  'regattr.cadastralNumber': 'Кадастровый номер',
  'regattr.plotArea': 'Площадь участка',
  'detail.attention': 'Требует внимания',
  'detail.attention_go': 'Перейти к этому чтению в реестре',
  'detail.observations': 'Наблюдения',
  'detail.observations_note':
    'Ни то, ни другое не является недостачей — в пакете просто больше, чем требует профиль.',
  'detail.seg.review': 'К проверке',
  'detail.seg.all': 'Все',
  'detail.seg.other': 'Прочее',
  'detail.other_group': '{n} прочих документов',
  'detail.other_group_one': '1 прочий документ',
  'detail.other_show': 'Показать',
  'detail.empty_filter': 'В этом виде ничего нет.',
  'detail.process_done': 'Проверка завершена',
  'detail.stages_done': '{n} этапов',
  'detail.required_found': '{n} из {total}',
  'detail.sheets': 'Листы',
  'detail.contents_rest': 'ещё {n}',
  'field.document_no': 'Номер документа',
  'field.expiry_date': 'Срок действия',
  'field.applicant_document_no': 'Номер документа заявителя',
  'field.property_address': 'Адрес объекта',
  'field.cadastral_number': 'Кадастровый номер',
  'field.application_date': 'Дата заявления',
  'field.project_name': 'Название проекта',
  'field.designer_name': 'Проектная организация',
  'field.total_area': 'Общая площадь',
  'field.approval_date': 'Дата утверждения',
  'field.building_height': 'Высота здания',
  'field.issuing_authority': 'Выдавший орган',
  'field.plot_area': 'Площадь участка',
  'field.plan_date': 'Дата плана',
  'field.order_no': 'Номер распоряжения',
  'field.receipt_no': 'Номер квитанции',
  'field.payer_name': 'Плательщик',
  'field.amount': 'Сумма оплаты',
  'field.payment_date': 'Дата оплаты',
  'field.payment_purpose': 'Назначение платежа',
  'field.storeys': 'Этажность',
  'field.certificate_no': 'Номер справки',
  'field.first_name': 'Имя',
  'field.last_name': 'Фамилия',
  'field.applicant_name': 'ФИО заявителя',
  'field.owner_name': 'ФИО владельца',
  'field.issue_date': 'Дата выдачи',
  // ── Загрузка реестра (ADR-0011) ────────────────────────────────────────────
  'reg.import.action': 'Загрузить файл реестра',
  'reg.import.title': 'Загрузка записей архивного реестра',
  'reg.import.subtitle':
    'Файл .xlsx: собственный шаблон реестра, по листу на каждую модель, либо один из архивных реестров — реестр сам определит, какой именно. Он сохранит все объекты, которые сможет прочитать, и отчитается об остальных.',
  'reg.import.no_file': 'Файл не выбран',
  'reg.import.choose': 'Выбрать файл',
  'reg.import.change': 'Заменить',
  'reg.import.send': 'Загрузить',
  'reg.import.again': 'Загрузить ещё раз',
  'reg.import.cancel': 'Отмена',
  'reg.import.close': 'Закрыть',
  'reg.import.sending': 'Передача… {p}%',
  'reg.import.reading': 'Реестр читает файл…',
  'reg.import.src.template':
    'Прочитан как собственный шаблон реестра — единственный файл с листом «Objects».',
  'reg.import.src.register': 'Распознан как {file}.',
  'reg.import.src.by.sheets': 'По именам листов.',
  'reg.import.src.by.fingerprint': 'По правилу самого реестра:',
  'reg.import.src.by.model': 'По ответу модели:',
  'reg.import.accepted': 'Реестр сохранил все объекты из файла.',
  'reg.import.partial':
    'Реестр сохранил то, что смог прочитать, и отклонил объектов: {n} — каждый указан ниже.',
  'reg.import.imported': 'Загружено',
  'reg.import.refused': 'Отклонено',
  'reg.import.rows.addresses': 'Адреса',
  'reg.import.rows.rightHolders': 'Правообладатели',
  'reg.import.rows.documents': 'Документы',
  'reg.import.rows.aliases': 'Иные номера',
  'reg.import.rows.locations': 'Места хранения',
  'reg.import.col.sheet': 'Лист',
  'reg.import.col.row': 'Строка',
  'reg.import.col.column': 'Столбец',
  'reg.import.col.message': 'Что не так',
  'reg.import.err.format': 'Реестр принимает файлы .xlsx — выберите такой.',
  'reg.import.err.size': 'Файл больше {max} МБ — это предел реестра.',
  'reg.import.err.unreachable':
    'Реестр не ответил. Проверьте, что он запущен, и повторите.',
  'lang.label': 'Язык',
  'theme.label': 'Оформление',
  'theme.light': 'Светлая',
  'theme.dark': 'Тёмная',
  'theme.to_light': 'Светлая тема',
  'theme.to_dark': 'Тёмная тема',
  'sidebar.toggle': 'Показать/скрыть панель',
  // ─── Refusals ───────────────────────────────────────────────────────────────
  // ─── Состояние заявления ───────────────────────────────────────────────────
  'detail.standing': 'Состояние заявления',
  'standing.Queued': 'В очереди',
  'standing.UnderVerification': 'Идёт проверка',
  'standing.Stalled': 'Проверка сорвалась',
  'standing.ShortOfDocuments': 'Не хватает документов',
  'standing.NeedsInspector': 'Нужен инспектор',
  'standing.AwaitingArchiveApproval': 'Архивный поиск не утверждён',
  'standing.Cleared': 'Замечаний нет',
  'standing.note.Queued': 'Пакет принят. Ни одна проверка его ещё не читала.',
  'standing.note.UnderVerification':
    'Проверка читает пакет — страница обновляется по мере завершения этапов.',
  'standing.note.Stalled':
    'Сломалась наша собственная механика, о документах не сделано никаких выводов. Догрузка файла запускает проверку заново.',
  'standing.note.ShortOfDocuments':
    'Документ, которого требует профиль, так и не поступил. Догрузите его ниже — пакет будет проверен заново.',
  'standing.note.NeedsInspector':
    'Комплект полный, но проверка вынесла замечания — каждое разбирает инспектор.',
  'standing.note.AwaitingArchiveApproval':
    'Замечаний к пакету нет. Архивный поиск, на котором он держится, ещё никем не утверждён.',
  'standing.note.Cleared':
    'Замечаний нет, и ничего не осталось. Решение о регистрации по-прежнему за вами.',
  // ─── Догрузка документов в открытый пакет (ADR-0013) ───────────────────────
  'add.title': 'Догрузка документов',
  'add.action': 'Догрузить документы',
  'add.note':
    'Документ, который так и не поступил, или читаемый скан листа, который не удалось прочитать. Каждый догруженный файл проверяется вместе с пакетом.',
  'add.note_reopens':
    'Догрузка открывает пакет заново: отчёт, сравнение документов и ответы архива сделаны по комплекту, который с тех пор изменился, поэтому они отбрасываются, а пакет проверяется заново. Прочитанное по каждому файлу сохраняется.',
  'add.closed_running':
    'Идёт проверка, поэтому сейчас пакет не принимает файлы — проверка читает тот комплект, с которым началась. Догрузите их, когда она закончится.',
  'add.none': 'Файлы пока не добавлены',
  'add.uploading': 'Загрузка…',
  'add.ready': 'Готово к догрузке: {n}',
  'add.send': 'Догрузить в пакет',
  'add.sending': 'Догружаем…',
  'add.done': 'Догружено: {n} — пакет проверяется заново',
  'add.failed': 'Не удалось догрузить файлы — попробуйте ещё раз',
  'error.UNKNOWN_PROFILE':
    'Такого профиля проверки больше нет — обновите страницу и выберите заново',
  'error.LEGAL_BASIS_NOT_IN_PROFILE':
    'Заявленное основание не относится к выбранному профилю — измените основание или профиль',
  'error.PACKAGE_MUST_HAVE_A_DOCUMENT':
    'В пакете должен быть хотя бы один документ',
  'error.UNSUPPORTED_CONTENT_TYPE':
    'Неподдерживаемый формат — только PDF, JPG или PNG',
  'error.INVALID_FILENAME':
    'Такое имя файла не сохранить — переименуйте и повторите',
  'error.INVALID_STORAGE_KEY':
    'Загруженный файл не найден — удалите его и добавьте снова',
  'error.CONCURRENCY_CONFLICT':
    'Пакет изменился во время работы — обновите страницу и повторите',
  'error.STORAGE_UNREACHABLE':
    'Хранилище документов недоступно — повторите позже',
  'error.OBJECT_BODY_MISSING':
    'Загруженный файл оказался пустым — добавьте его снова',
  'error.RATE_LIMITED': 'Слишком много запросов — повторите позже',
  'error.PACKAGE_NOT_TAKING_FILES':
    'Идёт проверка — файлы можно догрузить, когда она закончится',
  'error.PACKAGE_MUST_GAIN_A_FILE': 'Выберите хотя бы один файл',
  'error.PACKAGE_NOT_FOUND': 'Этого пакета больше нет в реестре',
  'error.DUPLICATE_STORAGE_KEY': 'Этот файл уже есть в пакете',
  // ─── Утверждение архивного поиска (ADR-0016) ───────────────────────────────
  'approve.title': 'Утверждение результатов архивного поиска',
  'approve.note':
    'Выше — что ответил реестр. Что это значит для заявления, решает человек: утверждение записывает этот вывод по тем ответам, которые есть сейчас.',
  'approve.no_author':
    'Учётных записей в системе нет, поэтому у утверждения нет имени — только вывод и время. Оно записано как решение управления, а не конкретного человека.',
  'approve.summary_label': 'Вывод по заявлению',
  'approve.summary_hint':
    'Что архивный поиск значит для заявления целиком — не по отдельной проверке, каждая из них уже сказала, что нашла. Обязательно: утверждение, которое фиксирует только сам факт, не фиксирует ничего.',
  'approve.summary_placeholder':
    'Запись реестра не противоречит поданным документам; отсутствие подлинника не влияет на заявленное право…',
  'approve.comment_label': 'Комментарий (необязательно)',
  'approve.comment_hint':
    'Оговорка или причина, по которой утверждено несмотря на замечание. Оставьте пустым, если её нет: пустой комментарий лучше формального.',
  'approve.comment_placeholder': 'Оговорка, если она есть…',
  'approve.left': 'осталось {n} символов',
  'approve.over': 'на {n} символов больше',
  'approve.action': 'Утвердить поиск',
  'approve.sending': 'Записываем…',
  'approve.done': 'Архивный поиск утверждён',
  'approve.failed': 'Не удалось записать утверждение — попробуйте ещё раз',
  'approve.given': 'Утверждено',
  'approve.remark': 'Комментарий',
  'approve.covered': 'Утверждено по этим ответам',
  'approve.now': 'сейчас',
  'approve.gone': 'больше не запрашивается',
  'approve.spent_since': 'перестало действовать {d}',
  'approve.spent_title': 'Прежние утверждения ({n})',
  'approve.spent_note':
    'После них архив опрашивали заново, поэтому они перестали действовать. Их не удаляют: что именно утвердили и по каким ответам — часть записи.',
  'approve.unsettled':
    'Идёт проверка, реестр ещё может ответить иначе. Утвердить поиск можно, когда она закончится.',
  'approve.not_asked':
    'Реестр по этому заявлению ни о чём не спрашивали — профиль не задаёт ему вопросов либо адрес не удалось прочитать ни на одном листе. Утверждать нечего.',
  'error.ARCHIVE_SEARCH_NOT_SETTLED':
    'Идёт проверка — утвердить поиск можно, когда она закончится',
  'error.ARCHIVE_SEARCH_NOT_ASKED': 'Реестр по этому заявлению не опрашивали',
  'error.ARCHIVE_SEARCH_ALREADY_APPROVED':
    'Этот архивный поиск уже утверждён — обновите страницу',

  // ── Оболочка рабочего места ────────────────────────────────────────────────
  'nav.intake': 'Приёмка заявления',
  'nav.search': 'Поиск по архиву',
  'nav.cases': 'Дела',
  'archive.data': 'Архивные данные',
  'archive.reach.asking': 'Запрашиваем архив…',
  'archive.reach.answering': 'Архив отвечает',
  'archive.reach.silent': 'Архив не отвечает',
  'archive.holdings.sources': 'Источники: {n}',
  'archive.holdings.records': 'Записи: {n}',
  'archive.holdings.loaded': 'Последняя загрузка: {date}',
  'archive.holdings.never': 'Ничего не загружено',
  'archive.holdings.nothing': 'не загружен',

  // ── Поиск по архиву ────────────────────────────────────────────────────────
  'page.search.title': 'Поиск по архиву',
  'page.search.subtitle':
    'Спросите архивный реестр, что он хранит об объекте, — ещё до того, как пакет принят.',
  'search.field.address': 'Адрес',
  'search.field.address_hint':
    'По нему ищут. Запись отвечает на любое написание, какое когда-либо завела её контора, — старый адрес тоже находит её.',
  'search.field.address_placeholder': 'Адрес или село',
  'search.field.name': 'ФИО заявителя',
  'search.field.name_hint':
    'По нему ищут. Иначе переданная латиницей фамилия всё равно найдёт запись; насколько они расходятся — видно в степени совпадения.',
  'search.field.name_placeholder': 'Фамилия, имя, отчество',
  'search.field.parcel': 'Участок / кадастровый номер',
  'search.field.parcel_hint':
    'По нему ищут — настолько, насколько он известен. Половина номера тоже вопрос, на который реестр отвечает.',
  'search.field.parcel_placeholder': 'Участок, реестр, свидетельство',
  'search.any_criterion':
    'Достаточно любого из трёх; вместе они не расширяют поиск, а сужают его.',
  'search.note':
    'Реестр сообщает, что хранится в его собственных фондах, и не судит ни о каком заявлении. Его охват неполный и исторический.',
  'search.submit': 'Искать в архиве',
  'search.searching': 'Ищем…',
  'search.threshold.label': 'Показывать не ниже',
  'search.band.high': 'Высокая',
  'search.band.probable': 'Вероятная',
  'search.band.possible': 'Возможная',
  'search.band.weak': 'Слабая',
  'search.matched': 'Совпадений: {n}',
  'search.considered': 'Сравнено записей: {n}.',
  'search.at_threshold': 'Показываются от «{band}» ({value}) и выше.',
  'search.sources': 'Ответившие источники',
  'search.panel.matches': 'Записи, которые предлагает архив',
  'search.silent_about':
    'У источника нет колонки: {fields}. Это молчание — оно не считается ни за, ни против.',
  'search.disputed': 'Источники расходятся',
  'search.panel.disagreements': 'Где источники расходятся',
  'search.disagreements.note':
    'Два реестра отвечают об одном объекте и записывают его по-разному. Реестр приводит оба и не решает спор — решает тот, кто может открыть папку.',
  'search.more':
    'Показаны самые уверенные {shown} из {n}. Уточните запрос, чтобы дойти до остальных.',
  'search.idle.title': 'Запрос ещё не отправлен',
  'search.idle.body':
    'Введите то, что есть, — адрес, фамилию, номер участка, — и реестр предложит записи, которые могут подойти.',
  'search.none.title': 'Архив здесь ничего не предлагает',
  'search.none.body':
    'Ничто из сравнённого не дотягивает до выбранного уровня. Охват реестра неполный и исторический, поэтому об объекте это не говорит ничего: снизьте уровень или ищите по меньшему числу полей.',
  'search.error.title': 'Архив не ответил',
  'search.error.body':
    'Обратиться к реестру не удалось. Попробуйте поиск ещё раз.',
  'search.footer':
    'Архив — это несколько реестров, которые тридцать лет вели разные конторы. О том, чего нет ни в одном из них, он не говорит ничего.',
  'archive.found': 'Запись найдена',
  'archive.found_note': 'Реестр хранит запись по этому адресу.',
  'archive.not_found': 'Записи нет',
  'archive.not_found_note':
    'По этому адресу реестр не хранит ничего. Его охват неполный и исторический, поэтому об объекте это не говорит ничего.',
  'archive.ambiguous': 'Записей несколько',
  'archive.ambiguous_note':
    'Этому адресу отвечает больше одной записи. Какая из них та самая, должен сказать человек.',
  'archive.canonical': 'Адрес в записи:',
  'archive.candidates': 'Записей, ответивших на адрес: {n}',
  'archive.vs': 'в записи',
  'archive.location': 'Место в архиве',
  'archive.location.value': 'папка {folder}, стр. {pages}',
  'archive.panel.record': 'Запись архива',
  'archive.panel.attributes': 'Сверено с записью',
  'archive.panel.documents': 'Документы, которые хранит архив',
  'archive.panel.source': 'Источник',
  'archive.source.register': 'Архивный реестр',
  'archive.field.register_no': 'Номер реестра',
  'archive.field.inventory_no': 'Инвентарный номер',
  'archive.field.address': 'Адрес',
  'archive.field.owner_name': 'Владелец',
  'archive.field.cadastral_number': 'Кадастровый номер',
  'archive.field.plot_area': 'Площадь участка',
  'archive.match.matches': 'Совпадает',
  'archive.match.differs': 'Расходится',
  'archive.match.not_recorded': 'Не записано',
  'archive.holding.held': 'Есть в архиве',
  'archive.holding.not_held': 'В архиве нет',
  'archive.holding.unknown': 'Не записано',

  // ── Приёмка заявления ──────────────────────────────────────────────────────
  'page.intake.title': 'Приёмка заявления',
  'page.intake.subtitle':
    'Добавьте пакет — система прочитает его, проверит и доложит, что нашла. Решаете вы.',
  'intake.step.add': 'Добавьте пакет',
  'intake.step.read': 'Мы его читаем',
  'intake.step.result': 'Результат',
  'intake.field.profile': 'Профиль проверки',
  'intake.profile.docs': 'обязательных документов: {n}',
  'intake.start': 'Запустить проверку',
  'intake.starting': 'Запуск…',
  'intake.failed': 'Не удалось открыть дело — попробуйте ещё раз',
  'intake.saved': 'Сохранено как дело',
  'intake.another': 'Принять ещё пакет',
  'intake.open_case': 'Открыть дело',
  'intake.recommendation': 'Рекомендация',
  'intake.read.title': 'Что мы прочитали в пакете',
  'intake.read.lead':
    'Заявитель, адрес и участок читаются из самих документов. Показание, в котором система не уверена, помечено — сверьте его с бумагами на карточке дела.',
  'intake.read.filling': 'заполняется само',
  'intake.read.reading': 'читаем…',
  'intake.read.unread': 'в пакете не прочитано',
  'intake.read.glance': 'прочитано на {p}% — стоит перепроверить',
  'intake.read.applicant': 'Заявитель',
  'intake.read.address': 'Адрес',
  'intake.read.parcel': 'Участок / номер реестра',
  'intake.group.documents': 'Документы',
  'intake.group.legal': 'Правовое основание',
  'intake.group.legal_none':
    'Проверка не назвала комплект подтверждающих документов для этого дела.',
  'intake.group.archive': 'Архив',
  'intake.group.archive_none': 'Архивный реестр по этому делу не запрашивался.',
  'intake.group.nothing': 'Здесь к пакету претензий нет.',
  // ── Заявленное на приёмке ──────────────────────────────────────────────────
  'declared.title': 'Заявлено при приёмке',
  'declared.basis': 'На основании чего право',
  'declared.year': 'Год постройки',
  'declared.not_declared': 'Не заявлено',
  'intake.profile.unchosen':
    'Выберите профиль проверки — под ним пакет и будет принят, и за вас его никто не выбирает.',
  'intake.declared.lead':
    'Необязательно и со слов заявителя, а не из документов. По этому подсказывается профиль; с тем, что прочитает движок, это не смешивается.',
  'intake.declared.basis_hint':
    'Документ, на котором держится заявленное право, — из тех, что этот профиль признаёт основанием.',
  'intake.declared.basis_stray':
    '«{ground}» — не основание профиля «{profile}». Выберите другое основание или другой профиль.',
  'intake.declared.year_hint':
    'Четыре цифры, {from}–{to}. Не знаете — оставьте пустым.',
  'intake.declared.year_placeholder': 'например, 1998',
  'intake.declared.year_outside':
    'Год читается в пределах {from}–{to} — этот принят не будет.',
  'intake.suggest.title': 'Подсказка профиля',
  'intake.suggest.undeclared':
    'Заявите основание или год — и здесь появится профиль, на который они указывают.',
  'intake.suggest.take': 'Выбрать этот профиль',
  'intake.suggest.chosen': 'выбран',
  'intake.suggest.asking': 'спрашиваем заново…',
  'intake.suggest.none':
    'Профиль не подсказан: заявленное не указывает на один. Почему — написано под тем полем, о котором речь.',
  'intake.suggest.unavailable':
    'Сейчас недоступна. Она только рекомендует — профиль, как и всегда, выбираете вы.',
  'suggest.basis.none':
    'Не заявлено. Именно документ-основание отличает один профиль от другого, поэтому без него профиль не подсказывается.',
  'suggest.basis.unregistered':
    'Ни один профиль не признаёт основанием «{ground}».',
  'suggest.basis.several':
    'Основанием «{ground}» право признают сразу несколько профилей — {profiles}. Какой из них это дело, из заявленного не следует.',
  'suggest.basis.only':
    '«{ground}» — основание профиля «{profile}», и других таких профилей нет.',
  'suggest.year.moot':
    'По основанию профиль не определился — уточнять годом нечего.',
  'suggest.year.any':
    'Не заявлен, и не нужен: «{profile}» отвечает за любой год.',
  'suggest.year.leaves': '{year} оставляет профиль «{profile}».',
  'suggest.year.awaited':
    'Не заявлен, а «{profile}» отвечает за определённый период — без года его нельзя ни принять, ни отвергнуть.',
  'suggest.year.undeclared': 'Не заявлен.',
  'suggest.year.rules_out':
    '{year} исключает «{profile}» — единственный профиль, на который указывает это основание.',
  'suggest.year.no_narrower': '{year} не сводит выбор к одному профилю.',

  // ── Дела ───────────────────────────────────────────────────────────────────
  'page.cases.title': 'Дела',
  'page.cases.subtitle':
    'Заявления, комплектность документов и замечания проверки — в одном реестре.',
  'action.intake': 'Приёмка заявления',
  'col.case': 'Дело',
  'col.applicant': 'Заявитель / Адрес',
  'col.state': 'Состояние и итог',
  'slice.label': 'Срезы реестра',
  'slice.all': 'Все',
  'slice.processing': 'В работе',
  'slice.remarks': 'С замечаниями',
  'slice.incomplete': 'Неполные',
  'slice.clean': 'Без замечаний',
  'slice.error': 'Сбой',
};

const az: Dict = {
  brand: 'Reyestr operatoru',
  authority: '8-ci maddə · Əmlak',
  'nav.workspace': 'İş sahəsi',
  'search.placeholder': 'Nömrə, fayl, kadastr nömrəsi, ünvan, mülkiyyətçi…',
  'search.label': 'Reyestrdə axtarış',
  'density.label': 'Sıxlıq',
  'density.comfortable': 'Rahat',
  'density.compact': 'Sıx',
  'col.documents': 'Sənədlər',
  'col.submitted': 'Təqdim',
  'col.status': 'Status',
  'status.ok': 'Qüsur yoxdur',
  'status.issues': 'Qüsurlar aşkarlandı',
  'status.incomplete': 'Natamam paket',
  'status.failed': 'Yoxlama alınmadı',
  'filter.standing': 'Vəziyyət',
  'filter.any_standing': 'İstənilən vəziyyət',
  'filter.outcome': 'Nəticə',
  'filter.any_outcome': 'İstənilən nəticə',
  'findings.issues': '{n} qüsur',
  'findings.issue_one': '1 qüsur',
  'findings.low': '{n} aşağı etibar',
  'findings.none': 'Yoxdur',
  'findings.noted': '{n} qeyd',
  'docs.count': '{r} tələbdən {d}',
  'stage.progress': 'Mərhələ {k} / {n}',
  'stage.1': 'OCR',
  'stage.2': 'Sənədlərin aşkarlanması',
  'stage.3': 'Təsnifat',
  'stage.4': 'Sahə çıxarışı',
  'stage.5': 'Sənədlərarası yoxlama',
  'stage.6': 'Arxiv reyestri',
  'stage.7': 'Tamlıq',
  'stage.8': 'Hesabat',
  'empty.title': 'Reyestr boşdur',
  'empty.body':
    'Yoxlamaya başlayın — paket burada emal gedişatı ilə görünəcək.',
  'empty.filtered.title': 'Uyğun paket yoxdur',
  'empty.filtered.body':
    'Bu axtarışa və bu süzgəclərə heç bir təqdimat uyğun gəlmir. Bütün reyestri görmək üçün onları təmizləyin.',
  'empty.clear': 'Süzgəcləri təmizlə',
  'register.error.title': 'Reyestr oxunmadı',
  'register.error.body':
    'Xidmət cavab vermədi, ona görə reyestrdə nə qədər təqdimat olduğu bilinmir — bu, boş reyestr deyil. Yenidən soruşun.',
  'register.error.retry': 'Yenidən soruş',
  'page.showing': '{n} paketdən {a}–{b}',
  // ── Reyestr icmalı (dövrün dörd kəsiyi) ────────────────────────────────────
  'summary.title': 'İcmal',
  'summary.period.label': 'Dövr',
  'summary.period.all': 'Bütün reyestr',
  'summary.period.last7': 'Son 7 gün',
  'summary.period.last30': 'Son 30 gün',
  'summary.period.month': 'Bu ay',
  'summary.period.year': 'Bu il',
  'summary.empty': 'Bu dövrdə heç nə yoxdur',
  'summary.error.body':
    'İcmal oxuna bilmədi, ona görə bu rəqəmlər bilinmir — bu, boş reyestr demək deyil.',
  'summary.stalled.label': 'Dayanıb:',
  'summary.stalled.body':
    '— mexanizm dayandı, gözləmək onları irəli aparmayacaq.',
  'summary.stalled.open': 'Dayananları aç',
  'summary.stalled.none': 'Heç nə dayanmayıb.',
  'summary.pipeline.title': 'İşin gedişi',
  'summary.pipeline.note': 'Bu dövrdə qəbul edilən təqdimat: {n}.',
  'summary.pipeline.pending': 'Oxunmasını gözləyir',
  'summary.pipeline.processing': 'Oxunur',
  'summary.pipeline.completed': 'Oxunub',
  'summary.pipeline.failed': 'Dayanıb',
  'summary.outcomes.title': 'Yoxlamaların nəticəsi',
  'summary.outcomes.note':
    'Hesabatı olan təqdimat: {total} -dan {n}. Hələ oxunanın nəticəsi yoxdur.',
  'summary.outcomes.unlinked':
    'Bu rəqəmlər reyestri yalnız bütövlükdə açır — siyahını hələ dövrə görə daraltmaq olmur.',
  'summary.archive.title': 'Arxiv reyestrinin cavabları',
  'summary.archive.note':
    'Reyestrə verilən sorğu: {n}. Profil bir təqdimat üzrə birdən çox sorğu verə bilər.',
  'summary.archive.not_found_note':
    'Reyestr öz fondları barədə cavab verir. «Tapılmadı» arxivdəki boşluqdur, təqdimatdakı qüsur deyil.',
  'summary.against.title': 'Paketə qarşı iradlar',
  'summary.against.note': 'Kiminsə həll etməli olduğu irad: {n}.',
  'summary.observations.title': 'Məlumat üçün qeyd edilib',
  'summary.observations.note':
    'Müşahidə: {n}. Başqa heç nə daşımayan hesabat yenə də «iradsız» oxunur.',
  'summary.findings.none': 'Bu dövrdə heç nə.',
  'summary.findings.unseen': 'Bu dövrdə rast gəlinməyən növ sayı: {n}.',
  'page.prev': 'Əvvəlki',
  'page.next': 'Növbəti',
  'updated.ago': '{t} əvvəl yeniləndi',
  open: 'Aç',
  'profile.cadastre': 'Fərdi yaşayış evinin ilkin dövlət qeydiyyatı',
  'upload.dropzone.title': 'Sənədləri buraya buraxın',
  'upload.dropzone.body': 'PDF, JPG və ya PNG · hər biri {max} MB-a qədər',
  'upload.dropzone.browse': 'Fayl seç',
  'upload.drop_overlay': 'Əlavə etmək üçün faylları buraxın',
  'upload.uploaded': 'Yükləndi',
  'upload.clear': 'Hamısını sil',
  'upload.remove': 'Sil',
  'upload.reading_pages': 'Səhifələr oxunur…',
  'upload.uploading': 'Yüklənir… {p}%',
  'upload.pages': '{n} səh.',
  'upload.page_one': '1 səh.',
  'upload.err.format': 'Dəstəklənməyən format — yalnız PDF, JPG və ya PNG',
  'upload.err.size': 'Çox böyük — maksimum {max} MB',
  'upload.err.failed': 'Yükləmə alınmadı',
  'upload.files.none': 'Hələ fayl əlavə edilməyib',
  'upload.files.all_label': 'fayl',
  'upload.files.uploading_label': 'yükləndi',
  'doctype.land_plot_plan': 'Torpaq sahəsinin plan-sxemi',
  'doctype.disposal_order': 'Sərəncam (və ya sərəncamdan çıxarış)',
  'doctype.payment_receipt': 'Ödəniş qəbzi',
  'doctype.sketch_project': 'Eskiz layihəsi',
  'doctype.archive_certificate': 'Arxiv arayışı',
  'doctype.application': 'Ərizə',
  'doctype.identity_card': 'Şəxsiyyəti təsdiq edən sənəd',
  'doctype.unknown': 'Naməlum növ',
  // Qanuni siyahının adını çəkmədiyi sənəd üçün qalan yeganə cavab. Açar
  // `out_of_profile` olaraq qalır — artıq yoxlanılmış bütün paketlərdə odur —
  // lakin müfəttiş sənədin siyahıda olmadığını oxuyur, bu profilin onu tələb
  // etmədiyini yox (ADR-0022).
  'doctype.out_of_profile': 'Digər sənədlər',
  // ── Sənəd kataloqu (ADR-0022) ──────────────────────────────────────────────
  // Yalnız zərflərdə rast gəlinən kağızlar deyil, hüququn əsaslana bildiyi bütün
  // qanuni siyahı: Dövlət reyestri haqqında Qanunun 8-ci maddəsi, 439 nömrəli
  // Fərman, ərizənin öz sənədləri və qeydiyyatçının xidməti vərəqləri. Adlar
  // çeklistdəndir, cədvəl sətrinə sığacaq qədər qısaldılıb — tam hüquqi ifadə
  // təsnifatçının işidir və kataloq qeydində qalır. Lüğətdə qarşılığı olmayan
  // açar özü kimi göstərilir (`translateOr`), ona görə kataloq bu siyahıdan
  // qabaqda böyüyə bilər.
  // Dövlət reyestri haqqında Qanunun 8-ci maddəsi üzrə əsaslar.
  'doctype.state_property_disposal_act':
    'Dövlət və ya bələdiyyə əmlakının özgəninkiləşdirilməsinə dair akt',
  'doctype.auction_results_protocol': 'Hərracın nəticələri haqqında protokol',
  'doctype.notarised_property_contract':
    'Daşınmaz əmlak barəsində notariat qaydasında təsdiq edilmiş müqavilə',
  'doctype.inheritance_certificate': 'Vərəsəlik hüququ haqqında şəhadətnamə',
  'doctype.spousal_share_certificate':
    'Ər-arvadın ümumi əmlakındakı paya mülkiyyət hüququ haqqında şəhadətnamə',
  'doctype.enforcement_sale_certificate':
    'İcra sənədlərinin məcburi icrası ilə əlaqədar əmlak barədə şəhadətnamə',
  'doctype.immovable_property_certificate': 'Daşınmaz əmlak sertifikatı',
  'doctype.court_decision': 'Qanuni qüvvəyə minmiş məhkəmə qərarı',
  'doctype.registration_certificate': 'Qeydiyyat vəsiqəsi',
  'doctype.property_right_certificate':
    'Daşınmaz əmlak üzərində hüquqları təsdiq edən şəhadətnamə',
  'doctype.housing_cooperative_allocation_decision':
    'Mənzil-tikinti kooperativi üzvlərinin ümumi yığıncağının qərarı',
  'doctype.garden_plot_allocation_document': 'Bağ sahəsinə dair sənəd',
  'doctype.operation_acceptance_act': 'İstismara qəbul aktı',
  'doctype.construction_permit_decision': 'Tikintiyə icazə barədə qərar',
  'doctype.architectural_planning_section':
    'Layihənin memarlıq-planlaşdırma bölməsi',
  'doctype.operation_permit': 'İstismara icazə',
  'doctype.construction_completion_notice':
    'Tikintinin başa çatması barədə məlumat',
  'doctype.disaster_replacement_housing_list':
    'Əvəzində ev verilən şəxslərin siyahısı',
  'doctype.state_housing_allocation_order':
    'Dövlət mənzil fondundan yaşayış sahəsinin verilməsinə dair order',
  'doctype.privatisation_contract': 'Özəlləşdirmə barədə müqavilə',
  'doctype.privatisation_consent_statement':
    'Özəlləşdirməyə razılıq barədə ərizə',
  'doctype.housing_office_certificate':
    'Mənzil istismar təşkilatının arayışı (2 №-li forma)',
  // 439 nömrəli Fərman üzrə əsaslar — reyestrdən əvvəlki hüquqlar.
  'doctype.soviet_land_record': 'Torpaq qeydləri',
  'doctype.land_right_state_act': 'Torpaq sahəsinə dair dövlət aktı',
  'doctype.temporary_land_use_certificate':
    'Torpaqdan müvəqqəti istifadə hüququna dair şəhadətnamə',
  'doctype.land_allocation_decision':
    'Torpaq sahələrinin ayrılması barədə qərar',
  'doctype.notarised_building_right_contract':
    'Tikinti hüququ barədə notariat qaydasında təsdiq edilmiş müqavilə',
  'doctype.notarised_land_allocation_contract':
    'Yaşayış evi üçün torpaq sahəsinin verilməsi müqaviləsi',
  'doctype.dwelling_transfer_decision':
    'Mənzilin şəxsin mülkiyyətinə verilməsi barədə qərar',
  'doctype.notarised_spousal_division_contract':
    'Ər-arvad arasında yaşayış evinin bölünməsi haqqında müqavilə',
  'doctype.house_inventory_valuation_passport':
    'Evlərin inventarizasiya və qiymətləndirilməsinə aid pasport',
  'doctype.household_book_extract': 'Təsərrüfatbaşına kitabından çıxarış',
  'doctype.kolkhoz_allocation_decision':
    'Kolxoz üzvlərinin ümumi yığıncağının qərarı',
  'doctype.sovkhoz_allocation_order': 'Sovxoz rəhbərinin əmri',
  'doctype.bound_land_book_extract': 'Qaytanlanmış torpaq kitabından çıxarış',
  'doctype.cooperative_land_allocation_decision':
    'Kooperativə torpaq sahəsinin ayrılması barədə qərar',
  'doctype.homestead_land_allocation_decision':
    'Həyətyanı torpaq sahəsinin ayrılması barədə qərar',
  'doctype.apartment_demolition_decision':
    'Mənzillərin sökülərək fərdi yaşayış evinin inşası barədə qərar',
  // Ərizənin özünün gətirdiyi sənədlər.
  'doctype.power_of_attorney': 'Etibarnamə',
  'doctype.legal_entity_register_extract':
    'Hüquqi şəxslərin dövlət reyestrindən çıxarış',
  'doctype.technical_passport': 'Texniki pasport',
  'doctype.state_register_extract':
    'Daşınmaz əmlakın dövlət reyestrindən çıxarış',
  // Qeydiyyatçının xidməti sənədləri.
  'doctype.registrar_routing_sheet': 'Dövriyyə vərəqi',
  'doctype.expert_review_sheet': 'Ekspertiza vərəqi',
  'doctype.designer_licence': 'Layihəçinin lisenziyası',
  'doctype.valuation_contract': 'Qiymətləndirmə müqaviləsi',
  'doctype.courier_waybill': 'Kuryer bildirişi',
  'doctype.covering_letter': 'Müşayiət məktubu',
  'detail.ocr_pending': 'OCR gözlənilir…',
  'detail.classifying': 'Təsnifat…',
  'detail.splitting': 'Səhifələrə bölünür…',
  'detail.pages_read': '{total} səhifədən {n}-i oxundu',
  'detail.unclassified': 'Təsnif edilmədi — uyğun sənəd növü tapılmadı.',
  'detail.out_of_profile':
    'Oxundu; qanuni sənəd siyahısında belə sənəd yoxdur.',
  'detail.ocr_done': 'Mətn tanındı',
  'detail.ocr_failed': 'OCR uğursuz oldu',
  'detail.view_text': 'Tanınan mətni göstər',
  'detail.no_fields': 'Sahələr çıxarılmadı',
  // ── Yoxlama təfərrüatı ───────────────────────────────────────────────────────
  'detail.back': 'Reyestrə qayıt',
  'detail.action.cancel': 'Yoxlamanı ləğv et',
  'detail.action.retry': 'Yenidən',
  'detail.action.rerun': 'Yenidən başlat',
  'detail.confirm_cancel': 'Bu yoxlama dayandırılsın?',
  'toast.cancelled': 'Yoxlama ləğv edildi — {id}',
  'toast.restarted': 'Yoxlama yenidən başladıldı — {id}',
  'detail.notfound.title': 'Paket tapılmadı',
  'detail.notfound.body': 'Bu paket reyestrdə yoxdur.',
  'detail.process': 'Yoxlama prosesi',
  'detail.stage_running': 'gedir…',
  'detail.in_progress_note': 'Yoxlama gedir — hər mərhələ bitdikcə yenilənir.',
  'detail.review_preparing': 'Yoxlama nəticələri hazırlanır',
  'detail.review_preparing_note':
    'Yekun siyahı təsnifat, sahələrin çıxarılması və müqayisələr bitəndən sonra görünəcək.',
  'detail.review_unavailable':
    'Yekun hesabat hazırlana bilmədi. Prosesin vəziyyətini və mənbə sənədlərini yoxlayın.',
  'detail.review_focus': 'Nəyə diqqət yetirməli',
  'detail.review_focus_note':
    'Qərar verməzdən əvvəl sıfır olmayan sayğaclı bölmələrdən başlayın.',
  'detail.focus_findings': 'Paket üzrə qeydlər',
  'detail.focus_comparisons': 'Sənədlərin müqayisəsi',
  'detail.focus_archive': 'Arxivlə müqayisə',
  'detail.focus_none': 'Əməliyyat tələb olunmur',
  'detail.focus_needs_review': 'Yoxlama tələb edir: {n}',
  'detail.failed_note': 'Yoxlama «{stage}» mərhələsində dayandı.',
  'detail.report': 'Yoxlama hesabatı',
  'detail.required': 'Tələb olunan sənədlər',
  'detail.required_all': 'Bütün tələb olunan sənədlər tapıldı.',
  'detail.required_missing': '{n} tapılmadı',
  'detail.required_pending': 'Təsnifat bitdikdən sonra yoxlanılır.',
  'detail.files': 'Fayllar',
  'detail.files_count': '{n} fayl',
  'detail.file_one': '1 fayl',
  'detail.detecting': 'Sənədlər aşkarlanır…',
  'detail.in_file_one': 'Bu faylda 1 sənəd',
  'detail.in_file': 'Bu faylda {n} sənəd',
  'detail.page_range': 'səh. {from}–{to}',
  'detail.page_single': 'səh. {n}',
  'detail.documents': 'Sənədlər',
  'detail.docs_count': '{r} sənəddən {d}',
  'detail.contents': 'Paketin tərkibi',
  'detail.source_text': 'Mənbə mətni',
  'detail.handwritten': 'Əlyazma',
  'detail.ocr': 'OCR',
  'detail.fields': 'Çıxarılan sahələr',
  'detail.pending': 'Çıxarış gözlənilir',
  'detail.needs_review': 'Yoxlama tələb edir',
  'detail.unscored': 'qiymətləndirilməyib',
  'detail.unscored_why':
    'Nə model, nə də marşrut etibarlılıq bildirmədi, ona görə də qeyd edilmədi. Bu oxunuşu vərəqlə tutuşdurun.',
  'detail.none': 'Yoxdur',
  'detail.th.field': 'Sahə',
  'detail.th.value': 'Dəyər',
  'detail.th.conf': 'Etibar',
  'detail.th.page': 'Səh.',
  'detail.page': 'Səh. {n}',
  'detail.sec.missing': 'Çatışmayan sənədlər',
  'detail.sec.unreadable': 'Oxuna bilmədi',
  'detail.sec.low': 'Aşağı etibar',
  'detail.sec.duplicate': 'İki dəfə təqdim edilib',
  'detail.sec.mismatch': 'Sənədlər arasında uyğunsuzluq',
  'detail.sec.extra': 'Paketdəki digər sənədlər',
  'detail.sec.registry_mismatch': 'Arxiv qeydi ilə uyğunsuzluq',
  'detail.sec.registry_document_missing': 'Əsli arxivdə yoxdur',
  'detail.sec.registry_unconfirmed': 'Reyestr təsdiqləmədi',
  'detail.sec.attestation': 'Möhür və ya imza yoxdur',
  'detail.sec.supporting': 'Gətirilməli təsdiqedici sənədlər',
  'detail.sec.declared_mismatch': 'Qəbulda bəyan ediləndən fərqlənir',
  'detail.clean':
    'Qüsur yoxdur — bütün tələb olunan sənədlər mövcuddur və etibar həddindən yuxarı oxunub.',
  'detail.clean_open_set':
    'Lakin bu iş üçün hansı təsdiqedici sənəd dəstinin tələb olunduğu müəyyən edilə bilmədi — aşağıya baxın.',
  'detail.f.missing_sub': 'Paketdə tapılmadı',
  'detail.f.unplaced_sub': 'Növü tanınmadı',
  'detail.f.unread_sheet_sub': 'Vərəq oxuna bilmədi',
  'detail.f.unread_file_sub': 'Sənədlərə ayrılmadı',
  'detail.f.low_sub': 'Etibar həddindən aşağı',
  'detail.f.extra_sub': 'Qanuni sənəd siyahısında adı çəkilmir',
  'detail.f.extra_named_sub': '{type} — bu profilin tələb etdiyi növ deyil',
  'detail.f.duplicate_sub': 'İkinci {type}',
  'detail.f.mismatch_sub': 'Sənədlər arasında uyğun gəlmir',
  'detail.f.unclear_sub': 'Birmənalı müəyyən edilə bilmədi',
  'detail.f.registry_mismatch_sub': 'Arxiv qeydi başqa cür göstərir',
  'detail.f.registry_document_missing_sub':
    'Bu sənədin əsli arxivdə saxlanılmır',
  'detail.f.registry_unconfirmed_sub': 'Qeyd yoxdur və ya birdən çoxdur',
  'detail.f.declared_sub': 'Qəbulda bəyan ediləndən fərqlənir',
  'detail.f.declared_year_sub': 'Qəbulda bəyan edilib: {year}',
  'detail.declared_note':
    'Qəbulda ərizəçinin sözündən yazılıb. Bu, oxunmuş dəyər deyil: onun etibarlılıq dərəcəsi yoxdur və mühərrikin sənədlərdən oxuduqları ilə birləşdirilmir.',
  'detail.f.attestation_sub': 'Üzərində möhür və ya imza oxunmadı',
  'supporting.lead':
    'Ərizəçinin paketdən əlavə gətirməli olduğu sənədlər. Onların heç biri paketdə olmayıb və olmalı da deyildi, ona görə buradakı heç nə təqdimata qarşı sayılmır və qüsur deyil.',
  'supporting.bring': 'Ərizəçi təsdiqedici sənəd dəstini gətirməlidir.',
  'supporting.placed':
    'Hansı dəstin tələb olunduğu aşağıdakı oxunuşa əsasən müəyyən edilib.',
  'supporting.unplaced':
    'Hansı dəstin tələb olunduğu bu paket üzrə müəyyən edilə bilmədi: seçimin asılı olduğu binanın hündürlüyü və ya il sənədlərin heç birindən oxunmadı. Qeydiyyat tamamlanmadan dəsti ərizəçi ilə dəqiqləşdirin.',
  'supporting.defined_by':
    '«{profile}» profili hər dəstin tərkibini müəyyən edir. Sənədlərin özləri hələ bu ekrana ötürülmür.',
  'supporting.decided_on': 'Nəyə əsasən',
  'detail.checks': 'Sənədlərarası yoxlama',
  'detail.checks_result': 'Sənədlərin müqayisə nəticələri',
  'detail.checks_result_note':
    'Profilin sənədlər arasında müqayisə etməyi tələb etdiyi sahələr. Hər dəyər mənbə sənədə və səhifəyə aparır.',
  'detail.checks_note':
    'Profilə görə bir neçə sənəddə eyni olmalı olan dəyərlər.',
  'detail.checks_pending': 'Bütün sənədlər oxunduqdan sonra aparılır.',
  'detail.checks_none': 'Bu paket üçün sənədlərin müqayisə nəticələri yoxdur.',
  'detail.checks_agreed': '{total} yoxlamadan {n} uyğundur',
  'detail.checks_go': 'Reyestrdə bu dəyərə keç',
  'detail.check_agreed': 'Uyğundur',
  'detail.check_disagreed': 'Uyğun deyil',
  'detail.check_unclear': 'Müəyyən edilmədi',
  'check.applicant_identity': 'Ərizəçi və şəxsiyyət vəsiqəsi',
  'check.identity_document_no': 'Şəxsiyyət vəsiqəsinin nömrəsi',
  'check.property_address': 'Obyektin ünvanı',
  'check.cadastral_number': 'Kadastr nömrəsi',
  'check.plot_area': 'Torpaq sahəsinin sahəsi',
  'check.property_of_record': 'Əmlak arxiv qeydi ilə üzləşdirilir',
  // ─── Arxiv reyestri ─────────────────────────────────────────────────────────
  'detail.registry': 'Arxiv reyestri',
  'detail.archive_comparison': 'Arxivlə müqayisə',
  'detail.registry_note':
    'Sənədlərin əmlak barədə dedikləri arxiv qeydi ilə tutuşdurulur. Paketdən kənara çıxan yeganə yoxlama.',
  'detail.registry_pending': 'Əmlakın ünvanı oxunandan sonra soruşulur.',
  'detail.registry_none':
    'Reyestr bu paket üzrə cavab vermədi: ya soruşduğu ünvan oxunmayıb, ya da reyestrə çatmaq olmayıb. Heç biri yoxlamanı dayandırmır.',
  'detail.registry_asked': 'Soruşulan ünvan',
  'detail.registry_where': 'Arxivdə',
  'detail.reg.confirmed': 'Qeyd təsdiqləyir',
  'detail.reg.differs': 'Qeyd fərqlənir',
  'detail.reg.incomplete': 'Əsli arxivdə yoxdur',
  'detail.reg.not_found': 'Qeyd yoxdur',
  'detail.reg.ambiguous': 'Bir neçə qeyd',
  'detail.reg.confirmed_note':
    'Qeyd tapıldı və onunla tutuşdurulan hər şey uyğun gəldi. Bu, sizin ayrıca arayış götürməyinizə ehtiyac qalmayan haldır.',
  'detail.reg.differs_note':
    'Qeyd tapıldı və başqa cür göstərir. Fərqlənən sənədlər deyil, məhz qeyddir.',
  'detail.reg.incomplete_note':
    'Qeyd tapıldı və paketlə uyğun gəlir. Arxivdə olmayan şey aşağıdakı sənədlərdən birinin əslidir; 439 nömrəli qərara əsaslanan hüquq üçün bu, formallıq deyil, etibarlılıq şərtidir.',
  'detail.reg.not_found_note':
    'Reyestrdə bu ünvan üzrə heç nə yoxdur. O, 1990–2000-ci illərin özəlləşdirmələrini əhatə edir, ona görə qeydin olmaması paket haqqında heç nə demir.',
  'detail.reg.ambiguous_note':
    'Bu ünvana birdən çox qeyd cavab verir. Hansının aid olduğunu sistem yox, siz deyirsiniz.',
  'detail.reg.submitted': 'Paketdə',
  'detail.reg.recorded': 'Qeyddə',
  'detail.reg.silent': 'reyestrdə belə sütun heç vaxt olmayıb',
  'detail.reg.papers': 'Arxivdəki sənədlər',
  'detail.reg.holding_held': 'Əsli arxivdə var',
  'detail.reg.holding_notheld': 'Əsli arxivdə yoxdur',
  'detail.reg.holding_unknown':
    'bu ərazinin arxivi belə sənədləri heç vaxt qeydə almayıb',
  'regattr.ownerName': 'Hüquq sahibi',
  'regattr.cadastralNumber': 'Kadastr nömrəsi',
  'regattr.plotArea': 'Torpaq sahəsi',
  'detail.attention': 'Diqqət tələb edir',
  'detail.attention_go': 'Reyestrdə bu oxunuşa keç',
  'detail.observations': 'Müşahidələr',
  'detail.observations_note':
    'Heç biri çatışmazlıq deyil — paketdə sadəcə profilin tələb etdiyindən artıq sənəd var.',
  'detail.seg.review': 'Yoxlamalı',
  'detail.seg.all': 'Hamısı',
  'detail.seg.other': 'Digər',
  'detail.other_group': 'Digər {n} sənəd',
  'detail.other_group_one': '1 digər sənəd',
  'detail.other_show': 'Göstər',
  'detail.empty_filter': 'Bu görünüşdə heç nə yoxdur.',
  'detail.process_done': 'Yoxlama tamamlandı',
  'detail.stages_done': '{n} mərhələ',
  'detail.required_found': '{total} sənəddən {n}',
  'detail.sheets': 'Vərəqlər',
  'detail.contents_rest': 'daha {n}',
  'field.document_no': 'Sənəd nömrəsi',
  'field.expiry_date': 'Etibarlılıq müddəti',
  'field.applicant_document_no': 'Ərizəçinin sənəd nömrəsi',
  'field.property_address': 'Obyektin ünvanı',
  'field.cadastral_number': 'Kadastr nömrəsi',
  'field.application_date': 'Ərizə tarixi',
  'field.project_name': 'Layihənin adı',
  'field.designer_name': 'Layihə təşkilatı',
  'field.total_area': 'Ümumi sahə',
  'field.approval_date': 'Təsdiq tarixi',
  'field.building_height': 'Binanın hündürlüyü',
  'field.issuing_authority': 'Verən orqan',
  'field.plot_area': 'Torpaq sahəsinin ölçüsü',
  'field.plan_date': 'Planın tarixi',
  'field.order_no': 'Sərəncamın nömrəsi',
  'field.receipt_no': 'Qəbzin nömrəsi',
  'field.payer_name': 'Ödəyici',
  'field.amount': 'Ödənilən məbləğ',
  'field.payment_date': 'Ödəniş tarixi',
  'field.payment_purpose': 'Ödənişin təyinatı',
  'field.storeys': 'Mərtəbələrin sayı',
  'field.certificate_no': 'Arayışın nömrəsi',
  'field.first_name': 'Ad',
  'field.last_name': 'Soyad',
  'field.applicant_name': 'Ərizəçinin adı',
  'field.owner_name': 'Sahibin adı',
  'field.issue_date': 'Verilmə tarixi',
  // ── Reyestrin yüklənməsi (ADR-0011) ────────────────────────────────────────
  'reg.import.action': 'Reyestr faylını yüklə',
  'reg.import.title': 'Arxiv reyestrinin qeydlərinin yüklənməsi',
  'reg.import.subtitle':
    'Bir .xlsx faylı: reyestrin öz şablonu — hər model üçün bir vərəq — və ya arxivin öz reyestrlərindən biri, hansı olduğunu reyestr özü tanıyır. Oxuya bildiyi bütün obyektləri saxlayır, qalanları barədə hesabat verir.',
  'reg.import.no_file': 'Fayl seçilməyib',
  'reg.import.choose': 'Fayl seç',
  'reg.import.change': 'Dəyiş',
  'reg.import.send': 'Yüklə',
  'reg.import.again': 'Yenidən yüklə',
  'reg.import.cancel': 'Ləğv et',
  'reg.import.close': 'Bağla',
  'reg.import.sending': 'Göndərilir… {p}%',
  'reg.import.reading': 'Reyestr faylı oxuyur…',
  'reg.import.src.template':
    'Reyestrin öz idxal şablonu kimi oxundu — “Objects” vərəqi olan yeganə fayl.',
  'reg.import.src.register': '{file} kimi tanındı.',
  'reg.import.src.by.sheets': 'Vərəq adlarına görə.',
  'reg.import.src.by.fingerprint': 'Reyestrin öz qaydasına görə:',
  'reg.import.src.by.model': 'Modelin cavabına görə:',
  'reg.import.accepted': 'Reyestr fayldakı bütün obyektləri saxladı.',
  'reg.import.partial':
    'Reyestr oxuya bildiyini saxladı, {n} obyekti qəbul etmədi — hər biri aşağıdadır.',
  'reg.import.imported': 'Yükləndi',
  'reg.import.refused': 'Qəbul edilmədi',
  'reg.import.rows.addresses': 'Ünvanlar',
  'reg.import.rows.rightHolders': 'Hüquq sahibləri',
  'reg.import.rows.documents': 'Sənədlər',
  'reg.import.rows.aliases': 'Digər nömrələr',
  'reg.import.rows.locations': 'Saxlanma yeri',
  'reg.import.col.sheet': 'Vərəq',
  'reg.import.col.row': 'Sətir',
  'reg.import.col.column': 'Sütun',
  'reg.import.col.message': 'Nə səhvdir',
  'reg.import.err.format':
    'Reyestr .xlsx fayllarını qəbul edir — belə bir fayl seçin.',
  'reg.import.err.size': 'Fayl {max} MB-dan böyükdür — bu, reyestrin həddidir.',
  'reg.import.err.unreachable':
    'Reyestr cavab vermədi. İşlədiyini yoxlayıb təkrar cəhd edin.',
  'lang.label': 'Dil',
  'theme.label': 'Görünüş',
  'theme.light': 'İşıqlı',
  'theme.dark': 'Qaranlıq',
  'theme.to_light': 'İşıqlı rejim',
  'theme.to_dark': 'Qaranlıq rejim',
  'sidebar.toggle': 'Paneli aç/bağla',
  // ─── Refusals ───────────────────────────────────────────────────────────────
  // ─── Müraciətin vəziyyəti ──────────────────────────────────────────────────
  'detail.standing': 'Vəziyyəti',
  'standing.Queued': 'Növbədə',
  'standing.UnderVerification': 'Yoxlanılır',
  'standing.Stalled': 'Yoxlama dayandı',
  'standing.ShortOfDocuments': 'Sənədlər çatmır',
  'standing.NeedsInspector': 'Müfəttiş baxmalıdır',
  'standing.AwaitingArchiveApproval': 'Arxiv axtarışı təsdiqlənməyib',
  'standing.Cleared': 'Qeyd yoxdur',
  'standing.note.Queued':
    'Paket qəbul edildi. Hələ heç bir yoxlama onu oxumayıb.',
  'standing.note.UnderVerification':
    'Yoxlama paketi oxuyur — hər mərhələ bitdikcə bu səhifə yenilənir.',
  'standing.note.Stalled':
    'Öz mexanizmimiz dayandı, sənədlər barədə heç bir nəticə çıxarılmadı. Fayl əlavə etmək yoxlamanı yenidən başladır.',
  'standing.note.ShortOfDocuments':
    'Profilin tələb etdiyi sənəd gəlməyib. Onu aşağıda əlavə edin — paket yenidən yoxlanacaq.',
  'standing.note.NeedsInspector':
    'Dəst tamdır, lakin yoxlama qeydlər çıxarıb — hər birini müfəttiş həll edir.',
  'standing.note.AwaitingArchiveApproval':
    'Paketə qarşı qeyd yoxdur. Söykəndiyi arxiv axtarışını hələ kimsə təsdiqləməyib.',
  'standing.note.Cleared':
    'Qeyd də yoxdur, gözləyən də. Qeydiyyat qərarı yenə də sizindir.',
  // ─── Mövcud paketə fayl əlavə etmək (ADR-0013) ─────────────────────────────
  'add.title': 'Sənəd əlavə et',
  'add.action': 'Sənəd əlavə et',
  'add.note':
    'Gəlməyən sənəd və ya oxunmayan vərəqin oxunaqlı skanı. Əlavə edilən hər fayl paketlə birlikdə yoxlanılır.',
  'add.note_reopens':
    'Fayl əlavə etmək bu paketi yenidən açır: hesabat, sənədlərin müqayisəsi və arxivin cavabları o vaxtdan dəyişmiş dəst üzərində alınıb, ona görə də ləğv edilir və paket yenidən yoxlanılır. Hər fayldan oxunanlar qalır.',
  'add.closed_running':
    'Yoxlama gedir, ona görə paket indi fayl qəbul etmir — yoxlama başladığı dəsti oxuyur. Bitəndən sonra əlavə edin.',
  'add.none': 'Hələ fayl əlavə edilməyib',
  'add.uploading': 'Yüklənir…',
  'add.ready': '{n} əlavə etməyə hazırdır',
  'add.send': 'Paketə əlavə et',
  'add.sending': 'Əlavə edilir…',
  'add.done': '{n} əlavə edildi — paket yenidən yoxlanılır',
  'add.failed': 'Fayllar əlavə edilmədi — yenidən cəhd edin',
  'error.UNKNOWN_PROFILE':
    'Bu yoxlama profili artıq yoxdur — səhifəni yeniləyib yenidən seçin',
  'error.LEGAL_BASIS_NOT_IN_PROFILE':
    'Bəyan edilən əsas bu profilin tanıdığı əsaslardan deyil — əsası və ya profili dəyişin',
  'error.PACKAGE_MUST_HAVE_A_DOCUMENT': 'Paketdə ən azı bir sənəd olmalıdır',
  'error.UNSUPPORTED_CONTENT_TYPE':
    'Dəstəklənməyən format — yalnız PDF, JPG və ya PNG',
  'error.INVALID_FILENAME':
    'Bu fayl adı saxlanıla bilmir — adını dəyişib yenidən cəhd edin',
  'error.INVALID_STORAGE_KEY':
    'Yüklənmiş fayl tapılmadı — silib yenidən əlavə edin',
  'error.CONCURRENCY_CONFLICT':
    'Paket iş zamanı dəyişdi — səhifəni yeniləyib təkrar cəhd edin',
  'error.STORAGE_UNREACHABLE':
    'Sənəd anbarı əlçatan deyil — bir az sonra cəhd edin',
  'error.OBJECT_BODY_MISSING': 'Yüklənmiş fayl boş gəldi — yenidən əlavə edin',
  'error.RATE_LIMITED': 'Çox sayda sorğu — bir az sonra cəhd edin',
  'error.PACKAGE_NOT_TAKING_FILES':
    'Yoxlama gedir — fayllar bitəndən sonra əlavə oluna bilər',
  'error.PACKAGE_MUST_GAIN_A_FILE': 'Ən azı bir fayl seçin',
  'error.PACKAGE_NOT_FOUND': 'Bu paket artıq reyestrdə yoxdur',
  'error.DUPLICATE_STORAGE_KEY': 'Bu fayl artıq paketdədir',
  // ─── Arxiv axtarışının təsdiqi (ADR-0016) ──────────────────────────────────
  'approve.title': 'Arxiv axtarışının təsdiqi',
  'approve.note':
    'Yuxarıda reyestrin cavabı var. Bunun bu ərizə üçün nə demək olduğunu insan deyir: təsdiq həmin nəticəni indiki cavablar üzrə qeyd edir.',
  'approve.no_author':
    'Sistemdə hesablar yoxdur, ona görə təsdiqin adı yoxdur — yalnız nəticə və vaxt. O, idarənin qərarı kimi yazılır, konkret şəxsin deyil.',
  'approve.summary_label': 'Ərizə üzrə nəticə',
  'approve.summary_hint':
    'Arxiv axtarışının bütöv ərizə üçün nə demək olduğu — ayrı-ayrı yoxlamalar üçün deyil, onların hər biri artıq nə tapdığını deyib. Mütləqdir: yalnız faktı qeyd edən təsdiq heç nə qeyd etmir.',
  'approve.summary_placeholder':
    'Reyestrin qeydi təqdim olunan sənədlərə zidd deyil; əslin olmaması iddia edilən hüquqa təsir etmir…',
  'approve.comment_label': 'Qeyd (məcburi deyil)',
  'approve.comment_hint':
    'Bir çəkinmə və ya nəyəsə baxmayaraq niyə təsdiqləndiyi. Yoxdursa, boş buraxın: boş qeyd formal qeyddən yaxşıdır.',
  'approve.comment_placeholder': 'Çəkinməniz varsa, yazın…',
  'approve.left': '{n} simvol qalıb',
  'approve.over': '{n} simvol artıqdır',
  'approve.action': 'Axtarışı təsdiqlə',
  'approve.sending': 'Yazılır…',
  'approve.done': 'Arxiv axtarışı təsdiqləndi',
  'approve.failed': 'Təsdiq yazılmadı — yenidən cəhd edin',
  'approve.given': 'Təsdiqlənib',
  'approve.remark': 'Qeyd',
  'approve.covered': 'Bu cavablar üzrə imzalanıb',
  'approve.now': 'indi',
  'approve.gone': 'artıq soruşulmur',
  'approve.spent_since': '{d} tarixindən qüvvədən düşüb',
  'approve.spent_title': 'Əvvəlki təsdiqlər ({n})',
  'approve.spent_note':
    'Onlardan sonra arxiv yenidən soruşulub, ona görə qüvvədən düşüblər. Silinmirlər: nəyin və hansı cavablar üzrə təsdiqləndiyi qeydin bir hissəsidir.',
  'approve.unsettled':
    'Yoxlama gedir, reyestr hələ başqa cavab verə bilər. Axtarışı yoxlama bitəndən sonra təsdiqləmək olar.',
  'approve.not_asked':
    'Bu təqdimat üzrə reyestrdən heç nə soruşulmayıb — profil ona sual vermir, yaxud heç bir vərəqdə ünvan oxunmayıb. Təsdiqləyəcək arxiv axtarışı yoxdur.',
  'error.ARCHIVE_SEARCH_NOT_SETTLED':
    'Yoxlama gedir — axtarışı bitəndən sonra təsdiqləmək olar',
  'error.ARCHIVE_SEARCH_NOT_ASKED':
    'Bu təqdimat üzrə reyestrdən heç nə soruşulmayıb',
  'error.ARCHIVE_SEARCH_ALREADY_APPROVED':
    'Bu arxiv axtarışı artıq təsdiqlənib — səhifəni yeniləyin',

  // ── İş sahəsinin çərçivəsi ─────────────────────────────────────────────────
  'nav.intake': 'Ərizənin qəbulu',
  'nav.search': 'Arxiv axtarışı',
  'nav.cases': 'İşlər',
  'archive.data': 'Arxiv məlumatları',
  'archive.reach.asking': 'Arxivdən soruşulur…',
  'archive.reach.answering': 'Arxiv cavab verir',
  'archive.reach.silent': 'Arxiv cavab vermir',
  'archive.holdings.sources': 'Mənbələr: {n}',
  'archive.holdings.records': 'Qeydlər: {n}',
  'archive.holdings.loaded': 'Son yüklənmə: {date}',
  'archive.holdings.never': 'Hələ heç nə yüklənməyib',
  'archive.holdings.nothing': 'yüklənməyib',

  // ── Arxiv axtarışı ─────────────────────────────────────────────────────────
  'page.search.title': 'Arxiv axtarışı',
  'page.search.subtitle':
    'Paket qəbul edilməzdən əvvəl arxiv reyestrindən obyekt haqqında nə saxladığını soruşun.',
  'search.field.address': 'Ünvan',
  'search.field.address_hint':
    'Buna görə axtarılır. Qeyd, onu yazan idarənin işlətdiyi hər yazılışa cavab verir — köhnə ünvan da onu tapır.',
  'search.field.address_placeholder': 'Ünvan və ya kənd',
  'search.field.name': 'Ərizəçinin adı',
  'search.field.name_hint':
    'Buna görə axtarılır. Fərqli transliterasiya olunmuş ad da qeydi tapır; nə qədər fərqləndiyi uyğunluq dərəcəsində görünür.',
  'search.field.name_placeholder': 'Soyad, ad, ata adı',
  'search.field.parcel': 'Sahə / kadastr nömrəsi',
  'search.field.parcel_hint':
    'Buna görə axtarılır — nə qədər məlumdursa. Nömrənin yarısı da reyestrin cavab verə biləcəyi sualdır.',
  'search.field.parcel_placeholder': 'Sahə, reyestr, şəhadətnamə',
  'search.any_criterion':
    'Üçündən biri kifayətdir; birlikdə axtarışı genişləndirmir, daraldırlar.',
  'search.note':
    'Reyestr yalnız öz fondlarında nə saxladığını bildirir və heç bir müraciət haqqında hökm vermir. Onun əhatəsi qismən və tarixidir.',
  'search.submit': 'Arxivdə axtar',
  'search.searching': 'Axtarılır…',
  'search.threshold.label': 'Ən azı bu səviyyədə',
  'search.band.high': 'Yüksək',
  'search.band.probable': 'Ehtimallı',
  'search.band.possible': 'Mümkün',
  'search.band.weak': 'Zəif',
  'search.matched': 'Uyğunluqlar: {n}',
  'search.considered': 'Müqayisə edilən qeydlər: {n}.',
  'search.at_threshold': '«{band}» ({value}) və yuxarı göstərilir.',
  'search.sources': 'Cavab verən mənbələr',
  'search.panel.matches': 'Arxivin təklif etdiyi qeydlər',
  'search.silent_about':
    'Mənbədə bunun üçün sütun yoxdur: {fields}. Bu sükutdur — nə lehinə, nə də əleyhinə sayılır.',
  'search.disputed': 'Mənbələr fərqlənir',
  'search.panel.disagreements': 'Mənbələrin fərqləndiyi yerlər',
  'search.disagreements.note':
    'İki reyestr eyni obyekt haqqında cavab verir və onu fərqli qeyd edir. Reyestr hər ikisini gətirir və mübahisəni həll etmir — bunu qovluğu aça bilən adam edir.',
  'search.more':
    'Ən əmin {shown} qeyd {n} qeyddən göstərilir. Qalanına çatmaq üçün sorğunu dəqiqləşdirin.',
  'search.idle.title': 'Hələ sorğu göndərilməyib',
  'search.idle.body':
    'Nəyiniz varsa yazın — ünvan, soyad, sahə nömrəsi — reyestr uyğun ola biləcək qeydləri təklif edəcək.',
  'search.none.title': 'Arxiv burada heç nə təklif etmir',
  'search.none.body':
    'Müqayisə edilənlərin heç biri seçilmiş səviyyəyə çatmır. Reyestrin əhatəsi qismən və tarixi olduğundan bu, obyekt haqqında heç nə demir — səviyyəni endirin və ya daha az sahə üzrə axtarın.',
  'search.error.title': 'Arxiv cavab vermədi',
  'search.error.body':
    'Reyestrə müraciət alınmadı. Axtarışı yenidən cəhd edin.',
  'search.footer':
    'Arxiv — otuz il ərzində müxtəlif idarələrin apardığı bir neçə reyestrdir. Heç birində olmayan barədə isə heç nə demir.',
  'archive.found': 'Qeyd tapıldı',
  'archive.found_note': 'Reyestr bu ünvan altında qeyd saxlayır.',
  'archive.not_found': 'Qeyd yoxdur',
  'archive.not_found_note':
    'Reyestr bu ünvan altında heç nə saxlamır. Əhatəsi qismən və tarixi olduğundan bu, obyekt haqqında heç nə demir.',
  'archive.ambiguous': 'Bir neçə qeyd',
  'archive.ambiguous_note':
    'Bu ünvana bir neçə qeyd cavab verir. Hansının aid olduğunu insan deməlidir.',
  'archive.canonical': 'Qeyddəki ünvan:',
  'archive.candidates': 'Ünvana cavab verən qeydlər: {n}',
  'archive.vs': 'qeyddə',
  'archive.location': 'Arxivdəki yer',
  'archive.location.value': 'qovluq {folder}, səh. {pages}',
  'archive.panel.record': 'Arxiv qeydi',
  'archive.panel.attributes': 'Qeydlə tutuşdurulanlar',
  'archive.panel.documents': 'Arxivin saxladığı sənədlər',
  'archive.panel.source': 'Mənbə',
  'archive.source.register': 'Arxiv reyestri',
  'archive.field.register_no': 'Reyestr nömrəsi',
  'archive.field.inventory_no': 'İnventar nömrəsi',
  'archive.field.address': 'Ünvan',
  'archive.field.owner_name': 'Sahibkar',
  'archive.field.cadastral_number': 'Kadastr nömrəsi',
  'archive.field.plot_area': 'Torpaq sahəsi',
  'archive.match.matches': 'Uyğundur',
  'archive.match.differs': 'Fərqlidir',
  'archive.match.not_recorded': 'Qeyd olunmayıb',
  'archive.holding.held': 'Arxivdə var',
  'archive.holding.not_held': 'Arxivdə yoxdur',
  'archive.holding.unknown': 'Qeyd olunmayıb',

  // ── Ərizənin ilkin yoxlanışı ───────────────────────────────────────────────
  'page.intake.title': 'Ərizənin ilkin yoxlanışı',
  'page.intake.subtitle':
    'Paketi əlavə edin — sistem onu oxuyur, yoxlayır və tapdığını bildirir. Qərarı siz verirsiniz.',
  'intake.step.add': 'Paketi əlavə edin',
  'intake.step.read': 'Onu oxuyuruq',
  'intake.step.result': 'Nəticə',
  'intake.field.profile': 'Yoxlama profili',
  'intake.profile.docs': 'mütləq sənədlər: {n}',
  'intake.start': 'Yoxlamanı başlat',
  'intake.starting': 'Başladılır…',
  'intake.failed': 'İş açıla bilmədi — yenidən cəhd edin',
  'intake.saved': 'İş kimi saxlanıldı',
  'intake.another': 'Başqa paket qəbul et',
  'intake.open_case': 'İşi aç',
  'intake.recommendation': 'Tövsiyə',
  'intake.read.title': 'Paketdən nə oxuduq',
  'intake.read.lead':
    'Ərizəçi, ünvan və sahə sənədlərin özündən oxunur. Sistemin əmin olmadığı oxunuş işarələnib — onu işin kartındakı sənədlərlə tutuşdurun.',
  'intake.read.filling': 'özü doldurulur',
  'intake.read.reading': 'oxunur…',
  'intake.read.unread': 'paketdən oxunmadı',
  'intake.read.glance': '{p}% oxundu — bir daha baxmağa dəyər',
  'intake.read.applicant': 'Ərizəçi',
  'intake.read.address': 'Ünvan',
  'intake.read.parcel': 'Sahə / reyestr nömrəsi',
  'intake.group.documents': 'Sənədlər',
  'intake.group.legal': 'Hüquqi əsas',
  'intake.group.legal_none':
    'Yoxlama bu iş üçün təsdiqedici sənəd dəsti adlandırmadı.',
  'intake.group.archive': 'Arxiv',
  'intake.group.archive_none':
    'Bu iş barədə arxiv reyestrinə sorğu verilməyib.',
  'intake.group.nothing': 'Burada pakete qarşı bir şey yoxdur.',
  // ── Qəbulda bəyan edilənlər ────────────────────────────────────────────────
  'declared.title': 'Qəbulda bəyan edilib',
  'declared.basis': 'Hüquq nəyə əsaslanır',
  'declared.year': 'Tikinti ili',
  'declared.not_declared': 'Bəyan edilməyib',
  'intake.profile.unchosen':
    'Yoxlama profilini seçin — paket seçdiyiniz profil üzrə qəbul olunur və onu sizin əvəzinizə heç kim seçmir.',
  'intake.declared.lead':
    'Məcburi deyil və sənədlərdən yox, ərizəçinin sözündən götürülür. Buna görə profil tövsiyə olunur; mühərrikin oxuduğu ilə qarışdırılmır.',
  'intake.declared.basis_hint':
    'İddia edilən hüququn dayandığı sənəd — bu profilin əsas kimi tanıdığı sənədlərdən.',
  'intake.declared.basis_stray':
    '“{ground}” — “{profile}” profilinin əsası deyil. Başqa əsas və ya başqa profil seçin.',
  'intake.declared.year_hint':
    'Dörd rəqəm, {from}–{to}. Bilmirsinizsə, boş buraxın.',
  'intake.declared.year_placeholder': 'məsələn, 1998',
  'intake.declared.year_outside':
    'İl {from}–{to} aralığında oxunur — bu il qəbul edilməyəcək.',
  'intake.suggest.title': 'Tövsiyə olunan profil',
  'intake.suggest.undeclared':
    'Əsası və ya ili bəyan edin — onların işarə etdiyi profil burada görünəcək.',
  'intake.suggest.take': 'Bu profili seç',
  'intake.suggest.chosen': 'seçilib',
  'intake.suggest.asking': 'yenidən soruşulur…',
  'intake.suggest.none':
    'Tövsiyə yoxdur: bəyan edilənlər tək bir profilə işarə etmir. Səbəbi aid olduğu sahənin altında yazılıb.',
  'intake.suggest.unavailable':
    'Hazırda əlçatan deyil. O yalnız tövsiyə edir — profili həmişəki kimi siz seçirsiniz.',
  'suggest.basis.none':
    'Bəyan edilməyib. Bir profili digərindən məhz hüququn əsaslandığı sənəd fərqləndirir, ona görə də o olmadan profil tövsiyə edilmir.',
  'suggest.basis.unregistered':
    'Heç bir profil “{ground}” əsasına söykənən hüququ qeydə almır.',
  'suggest.basis.several':
    '“{ground}” əsasına söykənən hüququ bir neçə profil qeydə alır — {profiles}. Bunlardan hansı olduğu bəyan edilənlərdən çıxmır.',
  'suggest.basis.only':
    '“{ground}” — “{profile}” profilinin əsasıdır və bunu edən yeganə profildir.',
  'suggest.year.moot':
    'Əsas üzrə profil müəyyən olunmadı — ilin dəqiqləşdirəcəyi bir şey yoxdur.',
  'suggest.year.any':
    'Bəyan edilməyib və lazım da deyil: “{profile}” istənilən il üçün cavab verir.',
  'suggest.year.leaves': '{year} “{profile}” profilini saxlayır.',
  'suggest.year.awaited':
    'Bəyan edilməyib, “{profile}” isə müəyyən dövr üçün cavab verir — il olmadan onu nə qəbul etmək, nə də kənarlaşdırmaq olar.',
  'suggest.year.undeclared': 'Bəyan edilməyib.',
  'suggest.year.rules_out':
    '{year} bu əsasın işarə etdiyi yeganə profili — “{profile}” — kənarlaşdırır.',
  'suggest.year.no_narrower': '{year} seçimi tək bir profilə endirmir.',

  // ── İşlər ──────────────────────────────────────────────────────────────────
  'page.cases.title': 'İşlər',
  'page.cases.subtitle':
    'Müraciətlər, sənədlərin tamlığı və yoxlama qeydləri bir reyestrdə.',
  'action.intake': 'Ərizənin qəbulu',
  'col.case': 'İş',
  'col.applicant': 'Ərizəçi / Ünvan',
  'col.state': 'Vəziyyət və nəticə',
  'slice.label': 'Reyestr kəsimləri',
  'slice.all': 'Hamısı',
  'slice.processing': 'İşlənir',
  'slice.remarks': 'Qeydli',
  'slice.incomplete': 'Natamam',
  'slice.clean': 'Qeydsiz',
  'slice.error': 'Nasazlıq',
};

/**
 * The three dictionaries, by locale.
 *
 * Exported for one reader only — the parity spec beside this file, which is
 * what makes "every string in all three languages" a rule the build enforces
 * rather than a habit. Screens read words through `useI18n`, never from here.
 */
export const DICTS: Record<Locale, Dict> = { en, ru, az };

type I18nValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('ru');

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let s = DICTS[locale][key] ?? en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return s;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-GB',
  ru: 'ru-RU',
  az: 'az-Latn-AZ',
};

/**
 * The Azerbaijani months, written out because the browser does not have them.
 *
 * Chromium ships no `az` date data at all — checked in Chromium 153, headless
 * and headed alike: `Intl.DateTimeFormat('az-Latn-AZ')` resolves to `az`, falls
 * back to the root locale and answers **"2026 M09 09"**, for `month: 'short'`
 * and `month: 'long'` equally, so asking for the long form is not a way out.
 * Node with full ICU has the data and answers "09 sen 2026", which is why this
 * only shows up in a browser.
 *
 * These are CLDR's own abbreviated forms — the same strings full ICU returns —
 * so the table is not a translation this repository invented: it is the data
 * the browser is missing, and a browser that gains it will agree with it.
 *
 * AZ is the customer's language. "M09" in it is not a rough edge, it is a date
 * they cannot read.
 */
const AZ_MONTHS_SHORT = [
  'yan',
  'fev',
  'mar',
  'apr',
  'may',
  'iyn',
  'iyl',
  'avq',
  'sen',
  'okt',
  'noy',
  'dek',
];

export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  // Local time on both branches — `getDate` and `Intl` without a `timeZone`
  // read the same clock, so the two locales never disagree about the day.
  if (locale === 'az') {
    const day = String(d.getDate()).padStart(2, '0');
    return `${day} ${AZ_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  try {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Compact "time ago" for live/in-progress rows. */
export function relativeShort(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.round(diff / 60000);
  if (m < 1) return '0m';
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
