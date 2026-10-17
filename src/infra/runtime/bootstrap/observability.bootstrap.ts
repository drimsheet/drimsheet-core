import bootstrapSentry from '@infra/integrations/sentry/sentry.bootstrap';

export default function bootstrapObservability(): void {
  bootstrapSentry();
}
