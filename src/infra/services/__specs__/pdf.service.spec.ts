import axios from 'axios';
import { extractText } from 'unpdf';

import makePdfService from '@infra/services/pdf.service';

jest.mock('axios');
jest.mock('unpdf', () => ({ extractText: jest.fn() }));

describe('PDF service', () => {
  const get = jest.mocked(axios.get);
  const extract = jest.mocked(extractText);
  const service = makePdfService();
  const url = 'https://files.example.com/receipt.pdf';
  const pdfBytes = new Uint8Array([37, 80, 68, 70]);

  beforeEach(() => {
    jest.resetAllMocks();
    get.mockResolvedValue({ data: pdfBytes.buffer });
    extract.mockResolvedValue({
      totalPages: 2,
      text: ['First page', 'Second page'],
    });
  });

  it.each([undefined, true])(
    'preserves page labels when preservePages is %s',
    async (preservePages) => {
      await expect(service.convertToText(url, preservePages)).resolves.toBe(
        '--- Page 1 of 2 ---\n\nFirst page\n\n' +
          '--- Page 2 of 2 ---\n\nSecond page'
      );
      expect(get).toHaveBeenCalledWith(url, { responseType: 'arraybuffer' });
      expect(extract).toHaveBeenCalledWith(pdfBytes, { mergePages: false });
    }
  );

  it('returns text without page labels when preservePages is false', async () => {
    await expect(service.convertToText(url, false)).resolves.toBe(
      'First page\n\nSecond page'
    );
  });

  it('retains the numbering of empty pages', async () => {
    extract.mockResolvedValue({ totalPages: 2, text: ['', 'Second page'] });

    await expect(service.convertToText(url)).resolves.toBe(
      '--- Page 1 of 2 ---\n\n\n\n--- Page 2 of 2 ---\n\nSecond page'
    );
  });

  it('propagates download failures', async () => {
    const error = new Error('Download failed');
    get.mockRejectedValue(error);

    await expect(service.convertToText(url)).rejects.toBe(error);
    expect(extract).not.toHaveBeenCalled();
  });

  it('propagates extraction failures', async () => {
    const error = new Error('Invalid PDF');
    extract.mockRejectedValue(error);

    await expect(service.convertToText(url)).rejects.toBe(error);
  });
});
