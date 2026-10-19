import IAppContextService from '@shared/contracts/app-context.service.contract';

import IAccountingContextQueryRepo from '@app/accounting/contracts/accounting-context.query.repo.contract';
import { IAccountingContextDto } from '@app/accounting/dtos/accounting-context/accounting-context.dto';
import accountingContextDtoMapper from '@app/accounting/dtos/accounting-context/accounting-context.dto.mapper';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingContextQueryRepo: IAccountingContextQueryRepo;
}

export default function makeGetAccountingContextsUsecase(deps: IDependencies) {
  return async (): Promise<IAccountingContextDto[]> => {
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    const contexts =
      await deps.accountingContextQueryRepo.findActiveByAccountingEntityId(
        accountingEntity.id,
        { correlationId }
      );

    return contexts.map(accountingContextDtoMapper.toDto);
  };
}
