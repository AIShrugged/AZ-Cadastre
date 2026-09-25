import type {
  DocumentTypeSpec,
  PageImage,
  PageNumber,
  RecognisedText,
  SheetGeometry,
} from '../../../domain/value-objects/index.js';

/*
 * One sheet offered for its geometry: the picture, and what was made of it.
 *
 * The picture is not optional here, unlike on an extraction sheet: geometry is
 * coordinates on an image, and a sheet with no image has none to give. The
 * transcription travels with it because the names printed in the rooms and the
 * marks in the axis circles are words, and a reader that has both reads them
 * better than one holding a bitmap.
 */
export type GeometrySheet = {
  number: PageNumber;
  image: PageImage;
  text: RecognisedText;
};

export type GeometryRequest = {
  sheets: readonly GeometrySheet[];
  // What kind of paper this is. The reader is told, for the same reason the
  // extractor is: what is on a foundation plan is not what is on a section.
  spec: DocumentTypeSpec;
};

/**
 * What a drawing's sheets carry, as shapes: room outlines, the axes the set
 * marks, and the dimension chain that runs along them (COMM-165).
 *
 * Its own port and not another field of the extraction schema, deliberately.
 * The span calculation is read off text and has been measured on four real
 * designs (`eval/span`); asking the same call for coordinates as well would put
 * that measurement back to nothing, because a longer answer is a different
 * answer. A reader that answers about nothing on a sheet answers with fewer
 * sheets than it was given, never with an empty shape.
 */
export abstract class SheetGeometryReader {
  abstract read(request: GeometryRequest): Promise<readonly SheetGeometry[]>;
}
