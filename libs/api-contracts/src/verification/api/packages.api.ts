import type {
  AddFilesRequest,
  ApproveArchiveSearchRequest,
  CreatePackageRequest,
  ListPackagesRequest,
  ListPackagesResponse,
  PackageDetailDto,
  PackageDto,
  PackagesOverviewRequest,
  PackagesOverviewResponse,
  SupplyDocumentRequest,
} from '../dto/index.js';

/**
 * What the verification context offers callers about submissions. Both sides of
 * every call import this: the context's service implements it, the gateway's
 * client port mirrors it, and the compiler keeps them the same shape.
 */
export interface PackagesApi {
  create(request: CreatePackageRequest): Promise<PackageDto>;
  /**
   * One page of the submissions, newest first, narrowed by what the caller
   * asked for. Never the whole list: it grows with every submission the office
   * takes in, and a call that returned all of them would be a call that gets
   * slower every week (ADR-0015).
   *
   * `ListPackagesRequestSchema` states what a search term matches and what the
   * two filters mean. They are two filters and not one because they answer two
   * questions — where the submission stands, and what the run found.
   */
  findMany(request: ListPackagesRequest): Promise<ListPackagesResponse>;
  findOne(id: string): Promise<PackageDetailDto>;

  /**
   * The four things an inspector opens a summary to ask, over the submissions
   * accepted in a period: how much work is in the machine, what the runs made
   * of it, what goes wrong most often, and how the archive register answers.
   *
   * One operation and not four, because four calls answer about four moments:
   * a submission that finishes between two of them is counted as processing by
   * one and as reported on by the next, and the screen shows numbers that do
   * not add up. Everything here is counted by the database in one transaction,
   * over rows that already exist — nothing accumulates it.
   *
   * `PackagesOverviewRequestSchema` states what the period means and which
   * timestamp it is over: when the submission was accepted, for all four slices
   * alike.
   */
  overview(request: PackagesOverviewRequest): Promise<PackagesOverviewResponse>;

  /**
   * Adds files to a package that already exists, and answers with the package
   * as it now stands.
   *
   * Allowed in the states `PackageStatusTakingFilesSchema` names, and refused
   * with `PACKAGE_NOT_TAKING_FILES` while a run is under way. A package that
   * had been reported on is re-opened: the report, the cross-document checks
   * and the register's answers were all worked out over an envelope that has
   * since changed, so they are discarded and the package is verified afresh.
   * What was read off each file on its own — its sheets, their text, the
   * documents carved out of them — survives (ADR-0013).
   */
  addFiles(id: string, request: AddFilesRequest): Promise<PackageDto>;

  /**
   * Sends one document in for one of the gaps `PackageDetailDto.gaps`
   * publishes, and answers with the package as it now stands (COMM-80).
   *
   * The difference from `addFiles` is that this file answers something. It
   * names the paper it is meant to be, and where it replaces a scan the run
   * read badly it names the document it stands in for — so the package can say
   * afterwards whether what arrived closed the gap it was sent for.
   *
   * Refused with `NO_SUCH_DOCUMENT_GAP` where the target is not one of the
   * published gaps, which is what keeps the offer and the accepted call the
   * same list; with `PACKAGE_NOT_TAKING_FILES` while a run is under way, like
   * `addFiles`; and with `DOCUMENT_NOT_IN_PACKAGE` where the document named as
   * replaced is not this package's.
   *
   * Whether the paper really is what it was sent in as is *not* answered here —
   * nothing has read it yet. That is the run's answer: the classifier places
   * what arrived, and where it is not the expected type the supply is refused —
   * the gap stays open, the document it was meant to replace stays in force,
   * and the report carries a `WrongDocumentSupplied` finding naming what was
   * asked for and what turned up.
   *
   * Where it *is* the expected type and the supply replaces a document, that
   * document goes out of force with the stamp of what replaced it and when. It
   * is never deleted: the report is compiled from the documents in force, and
   * the replaced one stays in the package as the record of what was sent first.
   *
   * Otherwise this behaves exactly like `addFiles`: the package re-opens, the
   * answers worked out across it are discarded, and it is verified afresh with
   * nothing re-read that was read before (ADR-0013).
   */
  supplyDocument(
    id: string,
    request: SupplyDocumentRequest,
  ): Promise<PackageDto>;

  /**
   * Records a person's approval of what the archive register answered about
   * this submission, and answers with the package as it now stands.
   *
   * The decision is about the submission and never about the register: the
   * register states what its own fonds hold and passes judgement on nobody's
   * application (ADR-0009). It is the one thing in a package a person puts
   * there rather than the engine, and it carries no author because the system
   * has no accounts to read one from (ADR-0016).
   *
   * Refused with `ARCHIVE_SEARCH_NOT_SETTLED` while a run could still replace
   * those answers, with `ARCHIVE_SEARCH_NOT_ASKED` where the register was never
   * asked anything, and with `ARCHIVE_SEARCH_ALREADY_APPROVED` where one is
   * already in force — an approval ends by the search being made again, never
   * by being overwritten.
   */
  approveArchiveSearch(
    id: string,
    request: ApproveArchiveSearchRequest,
  ): Promise<PackageDetailDto>;
}
