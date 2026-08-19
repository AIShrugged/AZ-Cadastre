import { InfrastructureException } from '@cadastre/shared';

export class MissingOpenRouterApiKeyException extends InfrastructureException {
  override readonly code = 'OPENROUTER_API_KEY_MISSING';

  constructor(
    public readonly providerSetting:
      | 'OCR_PROVIDER'
      | 'SEGMENTER_PROVIDER'
      | 'CLASSIFIER_PROVIDER'
      | 'EXTRACTOR_PROVIDER'
      | 'CROSS_CHECKER_PROVIDER',
  ) {
    super(
      `${providerSetting}=openrouter requires OPENROUTER_API_KEY to be set`,
    );
  }
}
