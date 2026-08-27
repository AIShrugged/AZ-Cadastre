import { describe, expect, it } from 'vitest';

import {
  DuplicatePageNumberException,
  PageNotInSourceFileException,
  SourceFileAlreadySplitException,
  SourceFileMustHaveAPageException,
} from '../exceptions/index.js';
import {
  Confidence,
  ContentType,
  Filename,
  OcrResult,
  PageId,
  PageImage,
  PageNumber,
  PageRange,
  RecognisedText,
  SourceFileId,
  StorageKey,
} from '../value-objects/index.js';

import { Page } from './page.entity.js';
import { SourceFile } from './source-file.entity.js';

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, '0')}`;
}

function aFile(): SourceFile {
  return SourceFile.create(
    SourceFileId.of(anId()),
    Filename.create('submission.pdf'),
    ContentType.PDF,
    StorageKey.create(`uploads/${anId()}.pdf`),
  );
}

function aPage(number: number): Page {
  return Page.create(
    PageId.of(anId()),
    PageNumber.of(number),
    PageImage.of(StorageKey.create(`pages/${anId()}.png`), ContentType.PNG),
  );
}

function anOcrResult(text: string): OcrResult {
  return OcrResult.of(RecognisedText.of(text), Confidence.of(0.9));
}

function range(first: number, last: number): PageRange {
  return PageRange.of(PageNumber.of(first), PageNumber.of(last));
}

describe('SourceFile', () => {
  it('has no pages until it is split', () => {
    const file = aFile();

    expect(file.pages).toEqual([]);
    expect(file.isSplit).toBe(false);
    expect(file.pageCount).toBe(0);
  });

  it('holds the pages it was split into', () => {
    const file = aFile().splitInto([aPage(1), aPage(2)]);

    expect(file.pageCount).toBe(2);
    expect(file.isSplit).toBe(true);
  });

  it('orders its pages by sheet, however they arrived', () => {
    const file = aFile().splitInto([aPage(3), aPage(1), aPage(2)]);

    expect(file.pages.map(page => page.number.value)).toEqual([1, 2, 3]);
  });

  it('refuses to be split twice', () => {
    const file = aFile().splitInto([aPage(1)]);

    expect(() => file.splitInto([aPage(1)])).toThrow(
      SourceFileAlreadySplitException,
    );
  });

  it('refuses to be split into no pages at all', () => {
    expect(() => aFile().splitInto([])).toThrow(
      SourceFileMustHaveAPageException,
    );
  });

  it('refuses two pages claiming the same sheet', () => {
    expect(() => aFile().splitInto([aPage(1), aPage(1)])).toThrow(
      DuplicatePageNumberException,
    );
  });

  it('spans every sheet it holds', () => {
    const file = aFile().splitInto([aPage(1), aPage(2), aPage(3)]);

    expect(file.wholeFile?.equals(range(1, 3))).toBe(true);
  });

  it('spans nothing before it is split', () => {
    expect(aFile().wholeFile).toBeNull();
  });

  it('records a reading against the page it was read from', () => {
    const pages = [aPage(1), aPage(2)];
    const file = aFile()
      .splitInto(pages)
      .recognised(pages[0]!.id, anOcrResult('first'));

    expect(file.pageWith(pages[0]!.id).isRecognised).toBe(true);
    expect(file.pageWith(pages[1]!.id).isRecognised).toBe(false);
  });

  it('refuses a reading for a page it does not hold', () => {
    const file = aFile().splitInto([aPage(1)]);

    expect(() =>
      file.recognised(PageId.of(anId()), anOcrResult('stray')),
    ).toThrow(PageNotInSourceFileException);
  });

  it('is fully recognised once every page has been read', () => {
    const pages = [aPage(1), aPage(2)];
    let file = aFile().splitInto(pages);

    file = file.recognised(pages[0]!.id, anOcrResult('first'));
    expect(file.isFullyRecognised).toBe(false);

    file = file.recognised(pages[1]!.id, anOcrResult('second'));
    expect(file.isFullyRecognised).toBe(true);
  });

  it('is not fully recognised before it is split', () => {
    expect(aFile().isFullyRecognised).toBe(false);
  });

  it('lists the pages still waiting to be read', () => {
    const pages = [aPage(1), aPage(2), aPage(3)];
    const file = aFile()
      .splitInto(pages)
      .recognised(pages[1]!.id, anOcrResult('second'));

    expect(file.unrecognisedPages.map(page => page.number.value)).toEqual([
      1, 3,
    ]);
  });

  it('hands back only the pages a range covers', () => {
    const file = aFile().splitInto([aPage(1), aPage(2), aPage(3), aPage(4)]);

    expect(file.pagesIn(range(2, 3)).map(page => page.number.value)).toEqual([
      2, 3,
    ]);
  });

  it('reads a range as the text of its pages, in sheet order', () => {
    const pages = [aPage(1), aPage(2), aPage(3)];
    let file = aFile().splitInto(pages);
    for (const [index, page] of pages.entries()) {
      file = file.recognised(page.id, anOcrResult(`sheet ${index + 1}`));
    }

    expect(file.textIn(range(2, 3)).value).toBe('sheet 2\nsheet 3');
  });

  it('reads a range with nothing recognised in it as empty text', () => {
    const file = aFile().splitInto([aPage(1), aPage(2)]);

    expect(file.textIn(range(1, 2)).isEmpty).toBe(true);
  });

  it('transcribes every sheet, unread ones as empty', () => {
    const pages = [aPage(1), aPage(2)];
    const file = aFile()
      .splitInto(pages)
      .recognised(pages[0]!.id, anOcrResult('first'));

    expect(
      file.transcript().map(sheet => [sheet.number.value, sheet.text.value]),
    ).toEqual([
      [1, 'first'],
      [2, ''],
    ]);
  });

  it('behaves the same restored as it does after being split', () => {
    const pages = [aPage(1), aPage(2)];
    const built = aFile()
      .splitInto(pages)
      .recognised(pages[0]!.id, anOcrResult('first'));

    const restored = SourceFile.restore({
      id: built.id,
      filename: built.filename,
      contentType: built.contentType,
      storageKey: built.storageKey,
      pages: [...built.pages].reverse(),
    });

    expect(restored.pages.map(page => page.number.value)).toEqual([1, 2]);
    expect(restored.isFullyRecognised).toBe(false);
    expect(restored.textIn(range(1, 2)).value).toBe('first');
  });
});
