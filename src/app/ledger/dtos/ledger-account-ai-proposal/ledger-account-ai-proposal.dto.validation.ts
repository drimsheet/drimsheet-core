import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ENormalBalance } from '@domain/ledger/types/ledger.types';

import {
  ledgerAccountBehaviorValidation,
  ledgerAccountSubTypeValidation,
  ledgerAccountTypeValidation,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';

import { ILedgerAccountAiProposal } from './ledger-account-ai-proposal.dto';

const undeterminedValidation = z.literal('__undetermined__');

export const ledgerAccountAiProposalDtoValidation = z.strictObject({
  temporaryId: z.string(),
  name: z.string(new ledgerAccountError.InvalidName().errorKey),
  type: ledgerAccountTypeValidation.or(undeterminedValidation),
  normalBalance: z
    .enum(
      ENormalBalance,
      new ledgerAccountError.InvalidNormalBalance().errorKey
    )
    .or(undeterminedValidation),
  subType: ledgerAccountSubTypeValidation.or(undeterminedValidation),
  behavior: ledgerAccountBehaviorValidation.or(undeterminedValidation),
}) satisfies z.ZodType<ILedgerAccountAiProposal>;
