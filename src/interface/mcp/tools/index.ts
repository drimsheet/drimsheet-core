import { IAgentTool } from '@app/ai/types/agent-tool';

import { counterpartyTools } from '@infra/ioc/tools/counterparty';
import { journalEntryTools } from '@infra/ioc/tools/journal-entry';
import { ledgerTools } from '@infra/ioc/tools/ledger';
import { moneyTools } from '@infra/ioc/tools/money';

export const mcpTools: IAgentTool[] = [
  ...counterpartyTools,
  ...journalEntryTools,
  ...ledgerTools,
  ...moneyTools,
];
