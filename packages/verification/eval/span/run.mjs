/*
 * How well the span is read off a design set — the measurement TECH_DEBT §18
 * asks for before the extraction model or the sheets it is shown are changed.
 *
 * It runs the production adapters and nothing written for it: the PDF is
 * rendered by the pipeline's own renderer, each sheet is transcribed by the
 * OpenRouter OCR adapter, the fields are read by the OpenRouter extractor with
 * the profile's own sketch_project schema, and the span is worked out by the
 * domain's own calculation (ADR-0043). What it adds is the ground truth in
 * `cases.json` and a score against it.
 *
 * Transcriptions are cached under `.cache/`, keyed by OCR model and DPI: they
 * are the expensive, slow half and do not change between two runs of the
 * extractor. The extractor is asked `RUNS` times per case, because one answer
 * of a model at temperature 0 is not its answer — OpenRouter may route the
 * next ask to another provider.
 *
 * Reads the build, so `pnpm --filter @cadastre/verification build` first.
 *
 *   pnpm --filter @cadastre/verification eval:span
 *   EXTRACTOR_MODEL=google/gemini-2.5-pro RUNS=2 CASES=proje44-novxani pnpm …
 *
 * Sends the sheets of the customer's own packages to OpenRouter, which is what
 * the pipeline does with them too; it is not something to point at a package
 * that has not been cleared for that.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The report is this script's output, not a log line: written to the streams
// directly rather than through `console`.
const say = (line = '') => process.stdout.write(`${line}\n`);
const warn = line => process.stderr.write(`${line}\n`);
const pkg = path.resolve(here, '../..');
const root = path.resolve(pkg, '../..');

// The first file to name a variable wins and the ambient environment beats
// both, the rule every other entry point here loads by.
for (const file of [
  path.join(pkg, '.env.local'),
  path.join(root, 'apps/server/.env.local'),
  path.join(root, 'apps/server/.env'),
]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const build = rel => import(path.join(pkg, 'build', rel));
const { renderPdfPages } = await build(
  'infrastructure/adapters/pdf-page-renderer.js',
);
const { OpenRouterOcrAdapter } = await build(
  'infrastructure/adapters/openrouter/ocr.adapter.js',
);
const { OpenRouterFieldExtractorAdapter } = await build(
  'infrastructure/adapters/openrouter/field-extractor.adapter.js',
);
const vo = await build('domain/value-objects/index.js');
const { spanCalculationOf } = await build('domain/services/index.js');
const { SilentLogger } = await import('@cadastre/logger');

const env = process.env;
const dpi = Number(env.PDF_PAGE_DPI ?? 300);
const runs = Number(env.RUNS ?? 3);
const only = env.CASES?.split(',').map(one => one.trim());
const ocrModel = env.OCR_MODEL ?? 'qwen/qwen2.5-vl-72b-instruct';
const extractorModel = env.EXTRACTOR_MODEL ?? 'qwen/qwen2.5-vl-72b-instruct';

if (!env.OPENROUTER_API_KEY) {
  warn('OPENROUTER_API_KEY is not set (apps/server/.env.local).');
  process.exit(1);
}

const options = {
  openrouter: {
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    appTitle: env.OPENROUTER_APP_TITLE ?? 'cadastre-eval',
  },
  ocr: { provider: 'openrouter', model: ocrModel, concurrency: 4 },
  extractor: { provider: 'openrouter', model: extractorModel },
};

/*
 * The object store, in memory, and the list of what was read out of it. The
 * extractor fetches the picture of each sheet it attaches, so the keys read
 * during an extraction are the sheets the model was shown — observed rather
 * than restated, which is what lets the same run measure the old rationing and
 * the new one.
 */
class MemoryStorage {
  objects = new Map();
  reads = [];

  put(key, body) {
    this.objects.set(key, body);
  }

  async getObject(key) {
    this.reads.push(key.value);
    const body = this.objects.get(key.value);
    if (!body) throw new Error(`No object ${key.value}`);
    return { body, contentType: vo.ContentType.of('image/png') };
  }
}

const storage = new MemoryStorage();
const logger = new SilentLogger();
const ocr = new OpenRouterOcrAdapter(options, storage, logger);
const extractor = new OpenRouterFieldExtractorAdapter(options, storage, logger);
const spec = vo.VerificationProfile.all
  .find(profile => profile.key === 'cadastre')
  .specFor(vo.DocumentType.create('sketch_project'));

const { cases } = JSON.parse(
  readFileSync(path.join(here, 'cases.json'), 'utf8'),
);

// ─── Scoring ────────────────────────────────────────────────────────────────

// "B—C 5200", "b-c 5 200" and "C–B 5200" are one entry.
function pairsOf(value) {
  if (!value) return new Map();
  const pairs = new Map();
  for (const entry of value.split(/[;\n]/u)) {
    const match =
      /^\s*(\d{1,2}|\p{Lu})\s*[-‐‑‒–—―−]\s*(\d{1,2}|\p{Lu})\s*[:=]?\s*([\d\s.,]+)/u.exec(
        entry,
      );
    if (!match) continue;
    const axes = [match[1], match[2]].sort().join('—');
    pairs.set(axes, Number(match[3].replace(/\s/gu, '').replace(',', '.')));
  }
  return pairs;
}

function areaOf(value) {
  const match = /(\d+(?:[.,]\d+)?)/u.exec(value ?? '');
  return match ? Number(match[1].replace(',', '.')) : null;
}

function score(expected, answer) {
  const want = pairsOf(expected.spanDimensions);
  const got = pairsOf(answer.spanDimensions);
  const right = [...want].filter(([axes, n]) => got.get(axes) === n).length;
  const invented = [...got.keys()].filter(axes => !want.has(axes)).length;
  const span = spanCalculationOf(
    answer.spanDimensions ?? '',
    answer.builtUpArea ?? null,
    answer.spanOverall ?? null,
  )?.longest;
  const spanRight =
    expected.span === null
      ? span === undefined || span === null
      : span !== undefined &&
        span !== null &&
        Math.abs(span - expected.span) < 1e-6;
  const area = areaOf(answer.builtUpArea);

  return {
    spanRight,
    span: span ?? null,
    pairsRight: right,
    pairsWanted: want.size,
    pairsInvented: invented,
    areaRight:
      expected.builtUpArea === null
        ? null
        : area !== null && Math.abs(area - expected.builtUpArea) < 0.05,
  };
}

// ─── One case ───────────────────────────────────────────────────────────────

// A provider saying no is not the sheet saying no: the pipeline offers each
// sheet up to three times (docs/MODELS.md), and so does this, with a pause.
async function patiently(ask) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await ask();
    } catch (error) {
      if (attempt >= 4) throw error;
      warn(
        `  … attempt ${attempt} refused (${error.status ?? error.name}), asking again`,
      );
      await new Promise(done => setTimeout(done, 5000 * attempt));
    }
  }
}

async function sheetsOf(one) {
  const pdf = new Uint8Array(readFileSync(path.join(root, one.pdf)));
  const cache = path.join(
    here,
    '.cache',
    ocrModel.replaceAll('/', '_'),
    String(dpi),
    one.id,
  );
  mkdirSync(cache, { recursive: true });

  const pages = [];
  for await (const page of renderPdfPages(vo.StorageKey.create(one.id), pdf, {
    pageDpi: dpi,
    maxPages: 80,
  })) {
    if (one.pages.includes(page.number)) pages.push(page);
  }

  const readOne = async page => {
    const key = `${one.id}/p${page.number}.png`;
    storage.put(key, page.png);
    const image = vo.PageImage.of(
      vo.StorageKey.create(key),
      vo.ContentType.of('image/png'),
    );
    const cached = path.join(cache, `p${page.number}.json`);
    let text;
    let read;
    if (existsSync(cached)) {
      ({ text, read } = JSON.parse(readFileSync(cached, 'utf8')));
    } else {
      const result = await patiently(() => ocr.recognise(image));
      text = result.text.value;
      read = result.confidence.value;
      writeFileSync(cached, JSON.stringify({ text, read }));
    }
    return {
      number: vo.PageNumber.of(page.number),
      image,
      text: vo.RecognisedText.of(text),
      read: vo.Confidence.of(read),
    };
  };

  // Three at a time: the shared upstream pool rate-limits a burst of a whole
  // set, and the pipeline's own width (OCR_CONCURRENCY) is four.
  const sheets = [];
  for (let at = 0; at < pages.length; at += 3) {
    sheets.push(...(await Promise.all(pages.slice(at, at + 3).map(readOne))));
  }

  return sheets;
}

async function measure(one) {
  const sheets = await sheetsOf(one);
  const text = vo.RecognisedText.of(
    sheets.map(sheet => sheet.text.value).join('\n'),
  );
  const answers = [];

  for (let run = 1; run <= runs; run += 1) {
    let fields = [];
    let error = null;
    try {
      fields = await patiently(() => {
        storage.reads = [];
        return extractor.extract({ text, sheets, spec });
      });
    } catch (cause) {
      error = cause.message;
    }
    const field = key =>
      fields.find(one => one.key.value === key)?.value.value ?? null;
    const answer = {
      spanDimensions: field('span_dimensions'),
      spanOverall: field('span_overall_dimensions'),
      builtUpArea: field('built_up_area'),
      pictured: storage.reads.map(key => Number(/p(\d+)\.png$/u.exec(key)[1])),
      error,
    };
    answers.push({ ...answer, ...score(one, answer) });
  }

  return { id: one.id, answers };
}

// ─── The run ────────────────────────────────────────────────────────────────

const chosen = cases.filter(one => !only || only.includes(one.id));
say(
  `span eval · extractor ${extractorModel} · ocr ${ocrModel} · ${dpi} dpi · ${runs} run(s) · ${chosen.length} case(s)\n`,
);

const results = [];
for (const one of chosen) {
  const result = await measure(one);
  results.push(result);

  say(`■ ${one.id}  (expected span ${one.span ?? 'none'})`);
  for (const [i, a] of result.answers.entries()) {
    say(
      `  #${i + 1} ${a.spanRight ? 'PASS' : 'FAIL'} span=${a.span ?? '—'}` +
        `  pairs ${a.pairsRight}/${a.pairsWanted} +${a.pairsInvented} invented` +
        `  area ${a.areaRight === null ? 'n/a' : a.areaRight ? 'ok' : 'wrong'}` +
        `  pictured [${a.pictured.join(',')}]` +
        (a.error ? `  ERROR ${a.error}` : ''),
    );
    say(`      span_dimensions: ${a.spanDimensions ?? 'null'}`);
    say(`      span_overall:    ${a.spanOverall ?? 'null'}`);
    say(`      built_up_area:   ${a.builtUpArea ?? 'null'}`);
  }
  say();
}

const all = results.flatMap(result => result.answers);
const passed = all.filter(answer => answer.spanRight).length;
const invented = all.reduce((sum, answer) => sum + answer.pairsInvented, 0);
say(`TOTAL span right ${passed}/${all.length} · invented pairs ${invented}`);

const out = path.join(here, 'results');
mkdirSync(out, { recursive: true });
const file = path.join(
  out,
  `${new Date().toISOString().replaceAll(':', '-')}-${extractorModel.replaceAll('/', '_')}.json`,
);
writeFileSync(
  file,
  JSON.stringify(
    { extractorModel, ocrModel, dpi, runs, passed, total: all.length, results },
    null,
    2,
  ),
);
say(`written ${path.relative(root, file)}`);
