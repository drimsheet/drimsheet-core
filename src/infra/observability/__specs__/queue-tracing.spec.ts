import mockTracer from '@shared/contracts/__mocks__/tracer.mock';

import {
  makeTraceEnvelope,
  traceQueueProcessing,
  unwrapTraceEnvelope,
} from '@infra/observability/queue-tracing';

describe('queue tracing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTracer.getPropagationCarrier.mockReturnValue({});
    mockTracer.continueTrace.mockImplementation((_carrier, operation) =>
      operation()
    );
    mockTracer.startRootSpan.mockImplementation((_options, operation) =>
      operation()
    );
    mockTracer.startSpan.mockImplementation((_options, operation) =>
      operation()
    );
  });

  it('envelopes an application payload with active propagation context', () => {
    const payload = { id: 'job-id' };
    const carrier = {
      sentryTrace: `${'a'.repeat(32)}-${'b'.repeat(16)}-1`,
      baggage: 'sentry-environment=staging',
    };
    mockTracer.getPropagationCarrier.mockReturnValue(carrier);

    const envelope = makeTraceEnvelope(
      'application-correlation',
      payload,
      mockTracer
    );

    expect(envelope).toEqual({
      __observabilityEnvelopeVersion: 1,
      correlationId: 'application-correlation',
      payload,
      trace: carrier,
    });
    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.trace)).toBe(true);
  });

  it('contains propagation failure and preserves enqueue payload', () => {
    const payload = { id: 'job-id' };
    mockTracer.getPropagationCarrier.mockImplementationOnce(() => {
      throw new Error('tracer unavailable');
    });

    expect(
      makeTraceEnvelope('application-correlation', payload, mockTracer)
    ).toEqual({
      __observabilityEnvelopeVersion: 1,
      correlationId: 'application-correlation',
      payload,
    });
  });

  it.each([{}, { sentryTrace: 'trace-header', baggage: 'baggage-header' }])(
    'unwraps correlation and payload with trace carrier %j',
    (trace) => {
      const payload = { id: 'job-id' };
      mockTracer.getPropagationCarrier.mockReturnValue(trace);
      const envelope = makeTraceEnvelope(
        'application-correlation',
        payload,
        mockTracer
      );
      const serialized = JSON.parse(JSON.stringify(envelope));
      expect(unwrapTraceEnvelope(serialized)).toEqual({
        correlationId: 'application-correlation',
        payload,
        trace,
      });
    }
  );

  it('drops malformed trace fields without losing correlation or payload', () => {
    const payload = { id: 'job-id' };
    expect(
      unwrapTraceEnvelope({
        __observabilityEnvelopeVersion: 1,
        correlationId: 'application-correlation',
        payload,
        trace: { sentryTrace: 42, baggage: {} },
      } as never)
    ).toEqual({ correlationId: 'application-correlation', payload, trace: {} });
  });

  it('continues incoming queue traces with controlled root metadata', () => {
    const carrier = { sentryTrace: 'trace-header' };
    const operation = jest.fn(() => 'processed');

    expect(
      traceQueueProcessing(
        mockTracer,
        'drimsheet-core.transactional-email',
        'bullmq',
        carrier,
        operation
      )
    ).toBe('processed');
    expect(mockTracer.continueTrace).toHaveBeenCalledWith(
      carrier,
      expect.any(Function)
    );
    expect(mockTracer.startSpan).toHaveBeenCalledWith(
      {
        name: 'queue.drimsheet_core_transactional_email',
        operation: 'queue.process',
        attributes: {
          'messaging.destination.name': 'drimsheet-core.transactional-email',
          'messaging.operation.type': 'process',
          'messaging.system': 'bullmq',
        },
      },
      operation
    );
  });

  it('creates a fresh root for messages without trace context', () => {
    const operation = jest.fn(() => 'processed');

    expect(
      traceQueueProcessing(mockTracer, '---', 'bullmq', {}, operation)
    ).toBe('processed');
    expect(mockTracer.startRootSpan).toHaveBeenCalledWith(
      {
        name: 'queue.unknown',
        operation: 'queue.process',
        attributes: {
          'messaging.destination.name': '---',
          'messaging.operation.type': 'process',
          'messaging.system': 'bullmq',
        },
      },
      operation
    );
    expect(mockTracer.continueTrace).not.toHaveBeenCalled();
  });

  it('trims only edge underscores from normalized queue span names', () => {
    const operation = jest.fn(() => 'processed');

    traceQueueProcessing(
      mockTracer,
      '___ledger__balance___',
      'bullmq',
      {},
      operation
    );

    expect(mockTracer.startRootSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'queue.ledger__balance' }),
      operation
    );
  });
});
