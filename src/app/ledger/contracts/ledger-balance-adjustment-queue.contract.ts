import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';

export const LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME =
  'ledger-account-balance-adjustment-queue' as const;

export default interface ILedgerBalanceAdjustmentQueue {
  add(
    correlationId: string,
    payload: ILedgerAccountBalanceAdjustmentDto
  ): Promise<void>;
}
