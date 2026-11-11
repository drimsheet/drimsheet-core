export const EFileAttachmentType = {
  Pdf: 'pdf',
  Excel: 'excel',
  Jpg: 'jpg',
  Png: 'png',
  Csv: 'csv',
} as const;

export type UFileAttachmentType =
  (typeof EFileAttachmentType)[keyof typeof EFileAttachmentType];

export interface IFileAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}
