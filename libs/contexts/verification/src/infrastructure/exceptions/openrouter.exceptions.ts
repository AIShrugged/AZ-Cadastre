import { InfrastructureException } from "@cadastre/kernel";

export class MissingOpenRouterApiKeyException extends InfrastructureException {
  override readonly code = "OPENROUTER_API_KEY_MISSING";

  constructor(
    public readonly providerSetting:
      | "OCR_PROVIDER"
      | "CLASSIFIER_PROVIDER"
      | "EXTRACTOR_PROVIDER",
  ) {
    super(
      `${providerSetting}=openrouter requires OPENROUTER_API_KEY to be set`,
    );
  }
}
