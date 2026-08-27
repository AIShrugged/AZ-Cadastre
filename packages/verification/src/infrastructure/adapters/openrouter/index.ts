/**
 * Everything that knows OpenRouter: the five port adapters that call it and the
 * two rules for reading what it answers — a route that returns HTTP 200 with no
 * `choices`, and the three shapes its providers mean by `logprobs`.
 */
export { OpenRouterClassifierAdapter } from './classifier.adapter.js';
export { OpenRouterCrossCheckerAdapter } from './cross-checker.adapter.js';
export { OpenRouterFieldExtractorAdapter } from './field-extractor.adapter.js';
export { OpenRouterOcrAdapter } from './ocr.adapter.js';
export { OpenRouterSegmenterAdapter } from './segmenter.adapter.js';
