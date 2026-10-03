import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import passport from 'passport';

import httpMiddlewares from '@infra/ioc/middlewares/http';
import cors from '@infra/server/cors';
import swagger from '@infra/server/swagger';

import nonControllerRoutes from '@interface/http/routes';
import healthRoute from '@interface/http/routes/health.route';

import { RegisterRoutes } from '../../../generated/routes';

export default function createApplication() {
  const app = express();
  app.set('trust proxy', false);

  app.use(healthRoute);

  app.use(httpMiddlewares.appContextInit);
  app.use(httpMiddlewares.requestLogger);

  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(cors());

  app.use(httpMiddlewares.globalRateLimiter);

  app.use(express.static('public'));

  app.use(compression());

  app.use(cookieParser());
  app.use(passport.initialize());

  app.use(httpMiddlewares.appContextEnrichment);

  app.use(...nonControllerRoutes);

  RegisterRoutes(app);

  app.use(...swagger());

  app.use(httpMiddlewares.errorHandler);

  return app;
}
