export type UTraceOperation =
  | 'app.usecase'
  | 'integration.run'
  | 'queue.process';

export interface ITraceCarrier {
  baggage?: string;
  sentryTrace?: string;
}

export interface ITraceIdentity {
  spanId: string;
  traceId: string;
}

export interface ITraceSpanOptions {
  attributes?: Readonly<
    Partial<
      Record<
        | 'messaging.destination.name'
        | 'messaging.operation.type'
        | 'messaging.system',
        string
      >
    >
  >;
  name: string;
  operation: UTraceOperation;
}

export default interface ITracer {
  continueTrace<T>(carrier: ITraceCarrier, operation: () => T): T;
  getActiveTrace(): ITraceIdentity | undefined;
  getPropagationCarrier(): ITraceCarrier;
  startRootSpan<T>(options: ITraceSpanOptions, operation: () => T): T;
  startSpan<T>(options: ITraceSpanOptions, operation: () => T): T;
}
