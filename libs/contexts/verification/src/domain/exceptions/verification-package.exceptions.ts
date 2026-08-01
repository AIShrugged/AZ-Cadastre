import { DomainException } from "@cadastre/kernel";

export class PackageMustHaveAFileException extends DomainException {
  override readonly code = "PACKAGE_MUST_HAVE_A_FILE";

  constructor() {
    super("A verification package must contain at least one file");
  }
}

export class DuplicateStorageKeyException extends DomainException {
  override readonly code = "DUPLICATE_STORAGE_KEY";

  constructor(public readonly storageKey: string) {
    super(`Two files in the package point at the same object: ${storageKey}`);
  }
}

export class SourceFileNotInPackageException extends DomainException {
  override readonly code = "SOURCE_FILE_NOT_IN_PACKAGE";

  constructor(
    public readonly sourceFileId: string,
    public readonly packageId: string,
  ) {
    super(`Package ${packageId} has no source file ${sourceFileId}`);
  }
}

export class DocumentNotInPackageException extends DomainException {
  override readonly code = "DOCUMENT_NOT_IN_PACKAGE";

  constructor(
    public readonly documentId: string,
    public readonly packageId: string,
  ) {
    super(`Package ${packageId} has no document ${documentId}`);
  }
}

export class InvalidPackageStatusException extends DomainException {
  override readonly code = "INVALID_PACKAGE_STATUS";

  constructor(public readonly received: string) {
    super(`"${received}" is not a verification package status`);
  }
}

export class PackageNotStartableException extends DomainException {
  override readonly code = "PACKAGE_NOT_STARTABLE";

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(
      `Package ${packageId} cannot be started while it is ${packageStatus}`,
    );
  }
}

export class PackageAlreadyFinishedException extends DomainException {
  override readonly code = "PACKAGE_ALREADY_FINISHED";

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(`Package ${packageId} has already finished as ${packageStatus}`);
  }
}

export class PackageNotUnderWayException extends DomainException {
  override readonly code = "PACKAGE_NOT_UNDER_WAY";

  constructor(
    public readonly packageId: string,
    public readonly packageStatus: string,
  ) {
    super(
      `Package ${packageId} is ${packageStatus}, so the pipeline cannot record against it`,
    );
  }
}
