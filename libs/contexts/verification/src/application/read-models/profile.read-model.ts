export type ProfileDocumentTypeView = {
  key: string;
  required: boolean;
};

export type ProfileView = {
  key: string;
  documentTypes: readonly ProfileDocumentTypeView[];
};
