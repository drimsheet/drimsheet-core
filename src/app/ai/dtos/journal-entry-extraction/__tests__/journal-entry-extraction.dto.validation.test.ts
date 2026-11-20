import generateUUID from '@shared/utils/uuid-generator';

import { IAgentRunContextDto } from '@app/ai/dtos/agent-run-context/agent-run-context.dto';
import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionDto,
} from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import {
  journalEntriesExtractionInputValidation,
  journalEntryExtractionDtoValidation,
} from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

describe('journal entry extraction DTO validation', () => {
  const context: IAgentRunContextDto = {
    id: generateUUID(),
    accountingEntityId: generateUUID(),
    correlationId: generateUUID(),
    agentActor: { id: generateUUID(), name: 'Drimsheet AI' },
    delegatingActor: { actorId: generateUUID(), name: 'Uploader' },
    initiatedOn: '2026-11-20T10:00:00.000Z',
    completedOn: null,
  };
  const attachment = {
    url: 'https://example.com/receipt.png',
    name: 'receipt.png',
    type: 'png',
    size: 1024,
  };
  const payload: IJournalEntryExtractionDto = {
    value: attachment,
    context,
  };

  it.each([attachment, 'Receipt total: 100 NGN'])(
    'preserves extraction input %j',
    (value) => {
      const job = { ...payload, value };
      expect(journalEntryExtractionDtoValidation.parse(job)).toEqual(job);
    }
  );

  it('requires the run context', () => {
    expect(
      journalEntryExtractionDtoValidation.safeParse({ value: attachment })
        .success
    ).toBe(false);
  });

  it('reports invalid nested context fields', () => {
    const parsed = journalEntryExtractionDtoValidation.safeParse({
      ...payload,
      context: { ...context, correlationId: 'invalid' },
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: ['context', 'correlationId'] }),
    ]);
  });

  it('reports invalid attachments at their nested path', () => {
    const parsed = journalEntryExtractionDtoValidation.safeParse({
      ...payload,
      value: { ...attachment, size: 0 },
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ['value', 'size'],
        message: 'file_attachment_error_size_invalid',
      }),
    ]);
  });

  it('rejects unexpected payload fields', () => {
    expect(
      journalEntryExtractionDtoValidation.safeParse({
        ...payload,
        extra: true,
      }).success
    ).toBe(false);
  });
});

describe('journal entries extraction input validation', () => {
  const attachment = {
    url: 'https://example.com/receipt.pdf',
    name: 'receipt.pdf',
    type: 'pdf',
    size: 1024,
  };

  it.each(['Receipt text\nTotal: 100 NGN', '', 'string', attachment])(
    'preserves input %j',
    (value) => {
      const input: IJournalEntriesExtractionInput = { value };
      const parsed: IJournalEntriesExtractionInput =
        journalEntriesExtractionInputValidation.parse(input);
      expect(parsed).toEqual(input);
    }
  );

  it.each([
    undefined,
    null,
    42,
    true,
    [],
    {},
    { ...attachment, size: 0 },
    { ...attachment, type: 'unsupported' },
    { ...attachment, url: 'invalid' },
  ])('rejects missing or invalid input %j', (value) => {
    expect(
      journalEntriesExtractionInputValidation.safeParse({ value }).success
    ).toBe(false);
  });

  it('rejects unexpected input fields', () => {
    expect(
      journalEntriesExtractionInputValidation.safeParse({
        value: 'Receipt text',
        extra: true,
      }).success
    ).toBe(false);
  });
});
