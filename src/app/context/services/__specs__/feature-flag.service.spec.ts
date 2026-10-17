import mockFeatureFlagService from '@shared/contracts/__mocks__/feature-flag.service.mock';

import makeFeatureFlagAppService from '@app/context/services/feature-flag.service';

describe('feature flag application service', () => {
  const service = makeFeatureFlagAppService({
    featureFlagService: mockFeatureFlagService,
  });

  beforeEach(() => {
    mockFeatureFlagService.isEnabled.mockReset();
  });

  it.each([true, false])(
    'returns %s for Alpha 1 access using the existing flag and deny fallback',
    async (canAccess) => {
      const context = { email: 'user@example.com' };
      mockFeatureFlagService.isEnabled.mockResolvedValue(canAccess);

      await expect(service.canAccessAlpha1(context)).resolves.toBe(canAccess);
      expect(mockFeatureFlagService.isEnabled).toHaveBeenCalledWith(
        'v_0_1_0_alpha_1',
        context,
        false
      );
    }
  );

  it('propagates evaluation failures', async () => {
    const error = new Error('Flag evaluation failed');
    mockFeatureFlagService.isEnabled.mockRejectedValue(error);

    await expect(
      service.canAccessAlpha1({ email: 'user@example.com' })
    ).rejects.toBe(error);
  });
});
