import { RequestHandler } from 'express';

import IAppContextService from '@shared/contracts/app-context.service.contract';
import appError from '@shared/values/errors/app.error';

import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';

import httpHandlers from '@infra/ioc/handlers/http';

export default function makeIsAuthenticatedUserMiddleware(
  appContext: IAppContextService<IAppContextData>,
  accountingEntityService: IAccountingEntityService
): RequestHandler {
  return async (req, res, next) => {
    try {
      const { user, accountingEntity } = appContext.get();

      if (!user) {
        throw new appError.Unauthorized();
      }

      if (accountingEntity) {
        const canAccessEntity = accountingEntityService.grantUserAccess(
          accountingEntity,
          user.id
        );

        if (!canAccessEntity) {
          throw new appError.Forbidden();
        }
      }

      next();
    } catch (error) {
      httpHandlers.error(req, res, error);
    }
  };
}
