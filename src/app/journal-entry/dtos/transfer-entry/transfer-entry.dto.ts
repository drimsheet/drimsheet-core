import { IJournalLineReq } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { IMoneyDto } from '@app/money/dtos/money/money.dto';

export interface ITransferEntryLineReq {
  accountId: string;
  amount: IMoneyDto;
  exchangeRate: IExchangeRateDto | null;
  description: string | null;
  sequenceOrder: number;
}

export interface ITransferEntryReq {
  /**
   * Opaque handles returned when preparing file uploads. Each corresponding
   * file must be uploaded before the transfer is created.
   */
  attachmentReferences?: string[];

  sourceLine: ITransferEntryLineReq;
  destinationLine: ITransferEntryLineReq;
  chargeLines: IJournalLineReq[];
  effectiveDate: Date;
  postedAt: Date | null;
  memo: string | null;
}

interface IUpdateDraftTransferAssetLineReq {
  id?: string;
  accountId?: string;
  amount?: IMoneyDto;
  exchangeRate?: IExchangeRateDto | null;
  description?: string | null;
  sequenceOrder?: number;
}

interface IUpdateDraftTransferChargeLineReq extends IUpdateDraftTransferAssetLineReq {
  counterpartyId?: string | null;
}

export interface IUpdateDraftTransferReq {
  sourceLine?: IUpdateDraftTransferAssetLineReq;
  destinationLine?: IUpdateDraftTransferAssetLineReq;
  /** When supplied, replaces the charge set. IDs retain existing charges. */
  chargeLines?: IUpdateDraftTransferChargeLineReq[];
  memo?: string | null;
}
