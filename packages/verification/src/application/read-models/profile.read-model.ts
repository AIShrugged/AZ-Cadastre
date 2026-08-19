export type ProfileDocumentTypeView = {
  key: string;
  required: boolean;
  // The field keys the type's schema declares, in schema order. Keys, not
  // labels: the profile's own labels are written for the extractor, and the
  // reader's language is the caller's to choose.
  fields: readonly string[];
};

export type ProfileView = {
  key: string;
  documentTypes: readonly ProfileDocumentTypeView[];
};
