import { EOutboxType } from '@shared/types/outbox.types';
import generateUUID from '@shared/utils/uuid-generator';

import outboxMapper, {
  IOutboxRepoModel,
} from '@infra/persistence/repos/outbox/mappers/outbox.mapper';

describe('outboxMapper', () => {
  const id = generateUUID();
  const correlationId = generateUUID();

  it('maps an application-supplied outbox row to its repository model', () => {
    expect(
      outboxMapper.toRepo({
        id,
        correlationId,
        type: EOutboxType.MissingOfficialFxRate,
        data: null,
      })
    ).toEqual({
      id,
      correlationId,
      type: EOutboxType.MissingOfficialFxRate,
      data: null,
    });
  });

  it('maps a repository row to the application outbox type', () => {
    const createdAt = '2026-08-18T12:00:00.000Z';
    const row: IOutboxRepoModel = {
      id,
      correlationId,
      type: EOutboxType.MissingOfficialFxRate,
      data: null,
      createdAt,
    };

    expect(outboxMapper.toDomain(row)).toEqual({
      id,
      correlationId,
      type: EOutboxType.MissingOfficialFxRate,
      data: null,
      createdAt: new Date(createdAt),
    });
  });
});
