import { makeAuthRateLimiters } from '@infra/config/rate-limiter.config';
import vars from '@infra/config/vars.config';
import featureFlagAppService from '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service';
import { accountingEntityService } from '@infra/ioc/services/accounting';
import { tokenAppService } from '@infra/ioc/services/auth';
import { actorService } from '@infra/ioc/services/user';
import { oAuthUseCase } from '@infra/ioc/usecases/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';
import appContext from '@infra/runtime/app-context';
import makeGlobalRateLimiter from '@infra/server/rate-limiter';

import makeAccountingEntityAccessMiddleware from '@interface/http/middlewares/accounting-entity-access.middleware';
import makeAppContextEnrichmentMiddleware from '@interface/http/middlewares/app-context-enrichment.middleware';
import makeAppContextInitMiddleware from '@interface/http/middlewares/app-context-init.middleware';
import makeErrorHandlerMiddleware from '@interface/http/middlewares/error-handler.middleware';
import makeFeatureFlagAccessMiddleware from '@interface/http/middlewares/feature-flag-access.middleware';
import {
  makeCompleteLoginWithGoogleMiddleware,
  makeInitiateLoginWithGoogleMiddleware,
} from '@interface/http/middlewares/google-oauth.middleware';
import makeIsAuthenticatedUserMiddleware from '@interface/http/middlewares/is-authenticated-user.middleware';
import makeRequestLoggerMiddleware from '@interface/http/middlewares/request-logger.middleware';
import makeSignupRateLimitMiddlewares from '@interface/http/middlewares/signup-rate-limit.middleware';

const httpMiddlewares = {
  globalRateLimiter: makeGlobalRateLimiter(observability.reporter),

  signupRateLimiters: makeSignupRateLimitMiddlewares(
    vars,
    observability.reporter
  ),

  authRateLimiters: makeAuthRateLimiters(vars, observability.reporter),

  initiateLoginWithGoogle: makeInitiateLoginWithGoogleMiddleware(),

  completeLoginWithGoogle: makeCompleteLoginWithGoogleMiddleware(
    oAuthUseCase.handleGoogleCallback
  ),

  appContextInit: makeAppContextInitMiddleware(appContext, vars),

  appContextEnrichment: makeAppContextEnrichmentMiddleware(
    appContext,
    accountingRepos.accountingEntity,
    tokenAppService,
    userRepos.user,
    actorService
  ),

  errorHandler: makeErrorHandlerMiddleware(),

  isAuthenticatedUser: makeIsAuthenticatedUserMiddleware(
    appContext,
    accountingEntityService
  ),

  requestLogger: makeRequestLoggerMiddleware(
    observability.logger,
    observability.httpMetrics
  ),

  accountingEntityAccess: makeAccountingEntityAccessMiddleware(
    accountingEntityService,
    appContext
  ),

  featureFlagAccess: makeFeatureFlagAccessMiddleware({
    featureFlagAppService: featureFlagAppService,
    appContext,
  }),
};

export default httpMiddlewares;
