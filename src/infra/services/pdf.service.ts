import axios from 'axios';
import { extractText } from 'unpdf';

import IPdfService from '@shared/contracts/pdf.service.contract';

/**
 * Downloads and extracts PDF text, optionally retaining numbered page labels.
 * Download and extraction failures propagate to the caller.
 */
function makeConvertToText(): IPdfService['convertToText'] {
  return async (url, preservePages = true) => {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
    });
    const pdfBytes = new Uint8Array(response.data);
    const { totalPages, text } = await extractText(pdfBytes, {
      mergePages: false,
    });

    if (preservePages) {
      return text
        .map(
          (pageText, index) =>
            `--- Page ${index + 1} of ${totalPages} ---\n\n${pageText}`
        )
        .join('\n\n');
    }

    return text.join('\n\n');
  };
}

export default function makePdfService(): IPdfService {
  const service: IPdfService = {
    convertToText: makeConvertToText(),
  };

  return Object.freeze(service);
}
