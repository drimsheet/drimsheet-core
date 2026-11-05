import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

interface IReceiptEntryLineReq extends IJournalLineReq {
  counterpartyId: string;
}

export interface IReceiptEntryReq {
  /**
   * Opaque handles returned when preparing file uploads. Each corresponding
   * file must be uploaded before the receipt is created.
   */
  attachmentReferences?: string[];

  sourceLines: IReceiptEntryLineReq[];
  destinationLine: IReceiptEntryLineReq;
  effectiveDate: Date;
  postedAt: Date | null;
  memo: string | null;
}
