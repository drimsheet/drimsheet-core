import appError from '@shared/values/errors/app.error';

import makeGetExchangeRatesTool from '@app/money/tools/get-exchange-rates.tool';

type TUseCase = Parameters<typeof makeGetExchangeRatesTool>[0]['usecase'];

describe('exchange rates tool', () => {
  const usecase = jest.fn<ReturnType<TUseCase>, Parameters<TUseCase>>();
  beforeEach(() => jest.resetAllMocks());

  it('passes parsed dates to the injected use case and preserves its array', async () => {
    const rates: Awaited<ReturnType<TUseCase>> = [];
    usecase.mockResolvedValue(rates);
    const tool = makeGetExchangeRatesTool({ usecase });
    const input = tool.inputSchema.parse({
      currencyPair: 'USD/NGN',
      asOf: '2026-01-01T00:00:00.000Z',
    });

    const response = await tool.func(input);

    expect(input.asOf).toBeInstanceOf(Date);
    expect(usecase).toHaveBeenCalledWith(input);
    expect(response.data).toBe(rates);
  });

  it('propagates failures unchanged', async () => {
    const error = new appError.BadRequest();
    usecase.mockRejectedValue(error);
    const tool = makeGetExchangeRatesTool({ usecase });

    await expect(
      tool.func(tool.inputSchema.parse({ currencyPair: 'USD/NGN' }))
    ).rejects.toBe(error);
  });
});
