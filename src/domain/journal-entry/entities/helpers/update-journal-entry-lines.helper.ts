import { IEvent } from '@shared/values/events/types/event.types';

import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import { IJournalLineAudit } from '@domain/journal-entry/types/journal-entry-audit.types';
import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

interface IPayload {
  createdBy: IJournalEntry['createdBy'];
  entry: IJournalEntry;
  lines: IJournalLine[];
  memo: IJournalEntry['memo'];
  updatedAt: Date;
}

interface IResult {
  lines: IJournalLine[];
  events: IEvent<IJournalLine>[];
  audits: IJournalLineAudit[];
}

export default function updateJournalEntryLines(payload: IPayload): IResult {
  const events: IResult['events'] = [];
  const audits: IResult['audits'] = [];
  const lines = payload.lines.map((newLine) => {
    const currentLine = payload.entry.lines.find(
      (line) => line.id === newLine.id
    );

    if (currentLine) {
      const [line, lineEvents, audit] = journalLineEntity.update(
        currentLine,
        newLine
      );

      events.push(...lineEvents);
      if (audit) {
        audits.push(audit);
      }

      return line;
    }

    const [line, lineEvents, audit] = journalLineEntity.make(
      {
        id: payload.entry.id,
        createdBy: payload.createdBy,
        memo: payload.memo,
        createdAt: payload.updatedAt,
      },
      {
        id: newLine.id,
        accountId: newLine.accountId,
        counterpartyId: newLine.counterpartyId,
        sequenceOrder: newLine.sequenceOrder,
        amount: newLine.amount,
        exchangeRate: newLine.exchangeRate,
        side: newLine.side,
        description: newLine.description,
        functionalCurrency: newLine.functionalAmount.currency,
      }
    );

    events.push(...lineEvents);
    audits.push(audit);

    return line;
  });

  return { lines, events, audits };
}
