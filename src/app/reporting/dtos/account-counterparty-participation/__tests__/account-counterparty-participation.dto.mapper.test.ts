import { TEntityId } from '@shared/types/uuid';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import accountCounterpartyParticipationMapper from '@app/reporting/dtos/account-counterparty-participation/account-counterparty-participation.dto.mapper';

describe('accountCounterpartyParticipationMapper', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const [counterparty] = counterpartyEntity.make({
    accountingEntityId: entityId,
    createdBy: entityId,
    name: 'Alice',
    type: 'individual',
  });
  const row = {
    counterparty,
    isSelf: false,
    amount: moneyValue.make(-120n, SYSTEM_CURRENCIES.USD, true),
    functionalAmount: moneyValue.make(-180n, SYSTEM_CURRENCIES.NGN, true),
    totalShare: -12,
  };

  it('maps both currencies and full counterparty details without exposing domain versions', () => {
    const dto = accountCounterpartyParticipationMapper.toDto(row);
    expect(dto).toEqual({
      counterparty: {
        id: counterparty.id,
        createdBy: entityId,
        accountingEntityId: entityId,
        name: 'Alice',
        status: 'active',
        type: 'individual',
        roles: [],
        meta: {},
        createdAt: counterparty.createdAt,
        updatedAt: counterparty.updatedAt,
      },
      isSelf: false,
      participation: {
        amount: { amount: -120, currencyCode: 'USD', isMinorUnit: true },
        functionalAmount: {
          amount: -180,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        totalShare: -12,
      },
    });
  });

  it.each([true, false])(
    'preserves a null counterparty with isSelf=%s and a null share',
    (isSelf) => {
      const dto = accountCounterpartyParticipationMapper.toDto({
        ...row,
        counterparty: null,
        isSelf,
        totalShare: null,
      });
      expect(dto.counterparty).toBeNull();
      expect(dto.isSelf).toBe(isSelf);
      expect(dto.participation.totalShare).toBeNull();
    }
  );
});
