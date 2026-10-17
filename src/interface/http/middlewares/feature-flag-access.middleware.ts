import { RequestHandler } from 'express';

import IAppContextService from '@shared/contracts/app-context.service.contract';

import IFeatureFlagAppService from '@app/context/contracts/feature-flag.service.contract';
import featureFlagError from '@app/context/errors/feature-flag.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  featureFlagAppService: IFeatureFlagAppService;
  appContext: IAppContextService<IAppContextData>;
}

type TMiddlewareShape = Record<keyof IFeatureFlagAppService, RequestHandler>;

export default function makeFeatureFlagAccessMiddleware(
  deps: IDependencies
): TMiddlewareShape {
  return {
    async canAccessAlpha1(req, res, next) {
      const { user } = deps.appContext.get(['user']);

      const canAccess = await deps.featureFlagAppService.canAccessAlpha1({
        email: user.email,
      });

      if (!canAccess) {
        throw new featureFlagError.NotPermitted();
      }

      next();
    },
  };
}
