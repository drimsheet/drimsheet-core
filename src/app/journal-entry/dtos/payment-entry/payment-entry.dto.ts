import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

interface IPaymentEntryLineReq extends IJournalLineReq {
  counterpartyId: string;
}

export interface IPaymentEntryReq {
  /**
   * Opaque handles returned when preparing file uploads. Each corresponding
   * file must be uploaded before the payment is created.
   */
  attachmentReferences?: string[];

  sourceLine: IPaymentEntryLineReq;
  destinationLines: IPaymentEntryLineReq[];
  effectiveDate: Date;
  postedAt: Date | null;
  memo: string | null;
}
