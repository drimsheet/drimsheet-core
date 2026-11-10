import { TEntityId } from '@shared/types/uuid';

import { journalEntryAttachmentsInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import journalEntryAttachmentRepo from '@infra/persistence/repos/journal-entry/journal-entry-attachment.repo.impl';
import journalEntryAttachmentMapper from '@infra/persistence/repos/journal-entry/mappers/journal-entry-attachment.mapper';

jest.mock('@infra/persistence/helpers/get-db-query.helper');
jest.mock('../mappers/journal-entry-attachment.mapper');

describe('journalEntryAttachmentRepo', () => {
  const conflictQuery = { onConflictDoUpdate: jest.fn() };
  const insertQuery = { values: jest.fn() };
  const query = { insert: jest.fn() };
  const options = { correlationId: 'test-correlation-id' };
  const journalEntryId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const attachments = [
    {
      url: 'https://files.example.com/receipt.pdf',
      name: 'receipt.pdf',
      type: 'application/pdf',
      size: 2048,
    },
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    jest.clearAllMocks();
    query.insert.mockReturnValue(insertQuery);
    insertQuery.values.mockReturnValue(conflictQuery);
    jest
      .mocked(getDbQueryHelper)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQueryHelper>);
    jest.mocked(journalEntryAttachmentMapper.toRepo).mockReturnValue({
      journalEntryId,
      data: attachments,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('upserts the complete attachment collection by journal entry ID', async () => {
    await journalEntryAttachmentRepo.save(journalEntryId, attachments, options);

    expect(getDbQueryHelper).toHaveBeenCalledWith(options);
    expect(journalEntryAttachmentMapper.toRepo).toHaveBeenCalledWith(
      journalEntryId,
      attachments
    );
    expect(query.insert).toHaveBeenCalledWith(journalEntryAttachmentsInCore);
    expect(insertQuery.values).toHaveBeenCalledWith({
      journalEntryId,
      data: attachments,
    });
    expect(conflictQuery.onConflictDoUpdate).toHaveBeenCalledWith({
      target: journalEntryAttachmentsInCore.journalEntryId,
      set: {
        data: attachments,
        updatedAt: '2026-08-26T12:00:00.000Z',
      },
    });
  });
});
