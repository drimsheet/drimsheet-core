import { RequestHandler } from 'express';

import IAppContextService from '@shared/contracts/app-context.service.contract';

import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';

export default function makeAccountingEntityAccessMiddleware(
  accountingEntityService: IAccountingEntityService,
  appContext: IAppContextService<IAppContextData>
): RequestHandler {
  return async (req, res, next) => {
    const { user, accountingEntity } = appContext.get([
      'user',
      'accountingEntity',
    ]);

    accountingEntityService.validateAccess(accountingEntity, user.id);

    next();
  };
}
