import { describe, expect, it } from "vitest";

import {
  BLANK_PAGE,
  isBlank,
  legibilityOf,
  readAsFarAsItGot,
} from "./transcription-marks.js";

describe("isBlank", () => {
  it("recognises the back of a stapled document for what it is", () => {
    expect(isBlank(BLANK_PAGE)).toBe(true);
    expect(isBlank(`\n  ${BLANK_PAGE}  \n`)).toBe(true);
  });

  it("does not take a sheet that merely mentions the mark for an empty one", () => {
    expect(isBlank(`ARXİV ARAYIŞI ${BLANK_PAGE}`)).toBe(false);
  });
});

describe("readAsFarAsItGot", () => {
  it("leaves a page the reader read straight through exactly as it was", () => {
    const page = "ARXİV ARAYIŞI\n№ 1-2-28/2-496/2025\n\nƏliyeva Rübabə Kavı qızı";

    expect(readAsFarAsItGot(page)).toEqual({ text: page, looped: false });
  });

  it("cuts a reader that stopped reading and started repeating itself", () => {
    // What a drawing sheet actually came back as: the explication table, then
    // eight hundred empty rows of it.
    const read = "Yerləşgələrin Eksplikasiyası\n| 1 | Otaq | 37.1 |";
    const runaway = Array.from({ length: 800 }, () => "|   |   |   |").join("\n");

    const { text, looped } = readAsFarAsItGot(`${read}\n${runaway}`);

    expect(looped).toBe(true);
    expect(text).toContain("Otaq");
    expect(text.length).toBeLessThan(read.length + 100);
  });

  it("cuts a reader that went round without ever starting a new line", () => {
    // The form it actually took on a drawing sheet: one line of 54,709
    // characters, 3,910 words, two of them distinct. Line-by-line the page
    // looked fine, which is why this is checked inside the line as well.
    const read = "Yerləşgələrin Eksplikasiyası";
    const runaway = Array.from({ length: 1000 }, () => "| |").join(" ");

    const { text, looped } = readAsFarAsItGot(`${read}\n${runaway}`);

    expect(looped).toBe(true);
    expect(text).toContain("Eksplikasiyası");
    expect(text.length).toBeLessThan(500);
  });

  it("leaves a long line of real text alone, however long it runs", () => {
    const clause =
      "Bu müqavilə bir tərəfdən Əliyeva Rübabə Kavı qızı qiymətləndirmə " +
      "fəaliyyəti ilə məşğul olmaq səlahiyyətinə malik gələcəkdə İcraçı " +
      "adlandırılacaq Daşınmaz Əmlakın Dövlət Kadastrı və Reyestri Publik " +
      "Hüquqi şəxsin 1 saylı Bakı Ərazi İdarəsi arasında aşağıdakı şərtlər " +
      "daxilində bağlanır və qüvvəyə minir.";

    expect(readAsFarAsItGot(clause).looped).toBe(false);
  });

  it("does not call a form with a few identical rows a runaway", () => {
    const form = ["Xüsusi qeydlər:", "", "", "", "", "İmza:"].join("\n");

    expect(readAsFarAsItGot(form).looped).toBe(false);
  });

  it("keeps the reading of the sheet that came before the repetition", () => {
    const runaway = Array.from({ length: 200 }, () => "").join("\n");

    const { text } = readAsFarAsItGot(`Faktiki ərazi 0,0468 ha.\n${runaway}`);

    expect(text).toBe("Faktiki ərazi 0,0468 ha.");
  });
});

describe("legibilityOf", () => {
  it("scores a page nobody hedged as fully legible", () => {
    expect(legibilityOf("ARXİV ARAYIŞI № 1-2-28/2-496/2025")).toBe(1);
  });

  it("scores an empty sheet as legible, because there was nothing to misread", () => {
    expect(legibilityOf(BLANK_PAGE)).toBe(1);
  });

  it("marks down a page in proportion to what the reader would not vouch for", () => {
    // Ten characters of hedged text in a forty-character reading.
    const text = `0123456789012345678901234567890<?abcdefghi>`;

    expect(legibilityOf(text)).toBeLessThan(1);
    expect(legibilityOf(text)).toBeGreaterThan(0.5);
  });

  it("scores a page the reader hedged from end to end as barely legible", () => {
    expect(legibilityOf("<?əliyeva rübabə kavı qızı>")).toBeLessThan(0.2);
  });

  it("stays inside 0..1, so the domain accepts it as a confidence", () => {
    const samples = [
      "",
      BLANK_PAGE,
      "plain text",
      "<?>",
      "<?a><?b><?c>",
      `${"x".repeat(500)}<?${"y".repeat(500)}>`,
    ];

    for (const sample of samples) {
      expect(legibilityOf(sample)).toBeGreaterThanOrEqual(0);
      expect(legibilityOf(sample)).toBeLessThanOrEqual(1);
    }
  });
});
