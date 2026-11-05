import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';

import safeGetCorrelationIdHelper from '@infra/observability/helpers/get-correlation-id.helper';

describe('safeGetCorrelationIdHelper', () => {
  const validCorrelationId = '0198ad49-0f4a-7709-a5bf-2f7cfbaea7c4';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the active correlation ID', () => {
    mockAppContext.get.mockReturnValue({
      correlationId: validCorrelationId,
      idempotencyKey: '',
    });

    expect(safeGetCorrelationIdHelper(mockAppContext)).toBe(validCorrelationId);
  });

  it('returns undefined for a malformed contextual correlation ID', () => {
    mockAppContext.get.mockReturnValue({
      correlationId: 'private.person@example.com',
      idempotencyKey: '',
    });

    expect(safeGetCorrelationIdHelper(mockAppContext)).toBeUndefined();
  });

  it('returns undefined without throwing when no store is active', () => {
    mockAppContext.get.mockImplementation(() => {
      throw new Error('No active store');
    });

    expect(() => safeGetCorrelationIdHelper(mockAppContext)).not.toThrow();
    expect(safeGetCorrelationIdHelper(mockAppContext)).toBeUndefined();
  });

  it('does not initialize or mutate context to generate a replacement ID', () => {
    mockAppContext.get.mockReturnValue({
      correlationId: 'malformed-correlation',
      idempotencyKey: '',
    });

    safeGetCorrelationIdHelper(mockAppContext);

    expect(mockAppContext.init).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });
});
