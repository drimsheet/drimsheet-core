import appError from '@shared/values/errors/app.error';

import makeGetCounterpartyTool from '@app/counterparty/tools/get-counterparty.tool';

type TUseCase = Parameters<typeof makeGetCounterpartyTool>[0]['usecase'];

describe('counterparty lookup tool', () => {
  it('unwraps the identifier and propagates the original use-case failure', async () => {
    const usecase = jest.fn<ReturnType<TUseCase>, Parameters<TUseCase>>();
    const error = new appError.BadRequest();
    usecase.mockRejectedValue(error);
    const tool = makeGetCounterpartyTool({ usecase });
    const id = 'a1111111-1111-4111-8111-111111111111';

    await expect(tool.func(tool.inputSchema.parse({ id }))).rejects.toBe(error);
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(usecase).toHaveBeenCalledWith(id);
  });
});
