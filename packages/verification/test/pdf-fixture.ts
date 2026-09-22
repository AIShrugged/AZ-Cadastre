/**
 * A PDF built by hand, one page per string, each drawing that string as text.
 *
 * A string carrying newlines is drawn as that many lines down the page, which
 * is how a fixture gets a text layer worth parsing rather than one line of it.
 *
 * By hand and not by a library: the structure is what is being exercised —
 * offsets, the text layer, the page count — and a generator would hide exactly
 * the part a reader of these specs has to be able to see.
 */
export function aPdfOf(...pages: string[]): Uint8Array {
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const pageIds = pages.map((_, index) => 4 + index * 2);

  objects[1] =
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] ` +
    `/Count ${pages.length} >>`;

  for (const [index, text] of pages.entries()) {
    const content = text
      .split('\n')
      .map(
        (line, row) => `BT /F1 12 Tf 72 ${700 - row * 16} Td (${line}) Tj ET`,
      )
      .join('\n');

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R >> >> ` +
        `/Contents ${pageIds[index]! + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];

  for (const [index, object] of objects.entries()) {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const startxref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  body +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${startxref}\n%%EOF\n`;

  // Latin-1: a PDF's structure is bytes, and every offset above counts them.
  return new Uint8Array(Buffer.from(body, 'latin1'));
}

/**
 * A PDF of `pages` pages with nothing on them a reader could parse — the shape
 * a scan has, where the words are in the picture and not in the file.
 */
export function aPdfWithoutATextLayerOf(pages: number): Uint8Array {
  return aPdfOf(...Array.from({ length: pages }, () => ''));
}
