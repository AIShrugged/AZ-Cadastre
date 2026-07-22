/** The file formats a Document may be uploaded in. */
export const DocumentFormat = {
  PDF: "PDF",
  JPG: "JPG",
  JPEG: "JPEG",
  PNG: "PNG",
} as const;

export type DocumentFormat = (typeof DocumentFormat)[keyof typeof DocumentFormat];

export function toDocumentFormat(value: string): DocumentFormat {
  const format = (Object.values(DocumentFormat) as string[]).includes(value)
    ? (value as DocumentFormat)
    : undefined;
  if (format === undefined) {
    throw new Error(`Unsupported file format: ${value}.`);
  }
  return format;
}
