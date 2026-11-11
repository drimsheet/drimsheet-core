export default interface IPdfService {
  /**
   * Downloads a PDF and returns its text. Page labels are included by default.
   * Rejects download and extraction failures.
   */
  convertToText(url: string, preservePages?: boolean): Promise<string>;
}
