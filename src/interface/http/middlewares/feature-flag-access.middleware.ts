import { RequestHandler } from 'express';

import IAppContext from '@app/context/contracts/app-context.contract';
import IFeatureFlagAppService from '@app/context/contracts/feature-flag.service.contract';
import featureFlagError from '@app/context/errors/feature-flag.error';

interface IDependencies {
  featureFlagAppService: IFeatureFlagAppService;
  appContext: IAppContext;
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
