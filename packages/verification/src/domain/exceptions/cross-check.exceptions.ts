import { DomainException } from "@cadastre/shared";

export class InvalidCrossCheckKeyException extends DomainException {
  override readonly code = "INVALID_CROSS_CHECK_KEY";

  constructor(public readonly reason: "empty" | "too_long") {
    super(`Cross-check key is ${reason}`);
  }
}

export class InvalidCrossCheckVerdictException extends DomainException {
  override readonly code = "INVALID_CROSS_CHECK_VERDICT";

  constructor(public readonly received: string) {
    super(`"${received}" is not a cross-check verdict`);
  }
}

export class CrossCheckNotInProfileException extends DomainException {
  override readonly code = "CROSS_CHECK_NOT_IN_PROFILE";

  constructor(
    public readonly key: string,
    public readonly profileKey: string,
  ) {
    super(`Profile "${profileKey}" declares no cross-check "${key}"`);
  }
}

export class CrossCheckMustCompareTwoDocumentsException extends DomainException {
  override readonly code = "CROSS_CHECK_MUST_COMPARE_TWO_DOCUMENTS";

  constructor(public readonly key: string) {
    super(
      `Cross-check "${key}" was recorded against fewer than two documents; ` +
        "one document's own values are not evidence about each other",
    );
  }
}
