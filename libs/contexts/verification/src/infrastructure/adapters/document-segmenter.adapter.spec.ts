import { describe, expect, it } from "vitest";

import type { ReadPage } from "../../application/ports/index.js";
import {
  PageNumber,
  RecognisedText,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { DocumentSegmenterAdapter } from "./document-segmenter.adapter.js";

const CADASTRE = VerificationProfile.CADASTRE.specs;

function sheets(...texts: readonly string[]): readonly ReadPage[] {
  return texts.map((text, index) => ({
    number: PageNumber.of(index + 1),
    text: RecognisedText.of(text),
  }));
}

async function spansOf(
  ...texts: readonly string[]
): Promise<[number, number][]> {
  const ranges = await new DocumentSegmenterAdapter().segment({
    pages: sheets(...texts),
    candidates: CADASTRE,
  });

  return ranges.map((range) => [range.first.value, range.last.value]);
}

describe("DocumentSegmenterAdapter", () => {
  it("reads a file of one sheet as one document", async () => {
    expect(await spansOf("ŞƏXSİYYƏT VƏSİQƏSİ")).toEqual([[1, 1]]);
  });

  it("reads sheets that all name the same type as one document", async () => {
    expect(
      await spansOf("LİSENZİYA səh. 1", "LİSENZİYA səh. 2", "LİSENZİYA səh. 3"),
    ).toEqual([[1, 3]]);
  });

  it("starts a new document where the type changes", async () => {
    expect(await spansOf("ŞƏXSİYYƏT VƏSİQƏSİ", "LİSENZİYA")).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });

  it("keeps a sheet naming no type with the document before it", async () => {
    expect(
      await spansOf(
        "ŞƏXSİYYƏT VƏSİQƏSİ",
        "verilib 2021, etibarlıdır 2030",
        "LİSENZİYA",
      ),
    ).toEqual([
      [1, 2],
      [3, 3],
    ]);
  });

  it("carries a leading sheet that names no type into the first document", async () => {
    expect(await spansOf("Skan edilmiş sənədlər", "ŞƏXSİYYƏT VƏSİQƏSİ")).toEqual(
      [[1, 2]],
    );
  });

  it("reads a file naming no type at all as one document", async () => {
    expect(await spansOf("oxunmur", "oxunmur")).toEqual([[1, 2]]);
  });

  it("cuts a licence off from the annex that follows it", async () => {
    expect(
      await spansOf(
        "LİSENZİYA",
        "Lisenziya No: AZ-LIC-2019-4471",
        "LİSENZİYAYA ƏLAVƏ",
      ),
    ).toEqual([
      [1, 2],
      [3, 3],
    ]);
  });

  it("finds every document in a full cadastre submission", async () => {
    expect(
      await spansOf(
        "DAŞINMAZ ƏMLAK ÜZƏRİNDƏ HÜQUQLARIN DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ",
        "ŞƏXSİYYƏT VƏSİQƏSİ",
        "BİLDİRİŞ İCRAATI QAYDASINDA ƏRİZƏ",
        "MEMARLIQ-PLANLAŞDIRMA HƏLLİ",
        "vərəq 2 — planlar",
        "LİSENZİYA",
        "LİSENZİYAYA ƏLAVƏ",
      ),
    ).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 5],
      [6, 6],
      [7, 7],
    ]);
  });

  it("finds no document in a file with no sheets", async () => {
    expect(await spansOf()).toEqual([]);
  });
});
