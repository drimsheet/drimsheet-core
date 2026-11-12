interface IPreSignFileUploadPayload {
  key: string;
  contentType: string;
  metadata: Readonly<Record<string, string>>;
}

interface IFileUploadInstruction {
  uploadUrl: string;
  fileUrl: string;
  headers: Readonly<Record<string, string>>;
}

interface IFileByteRange {
  start: number;
  end: number;
}

interface IReadStoredFilePayload {
  key: string;
  range?: IFileByteRange;
}

interface IStoredFile {
  fileUrl: string;
  contentType: string;
  size: number;
  metadata: Readonly<Record<string, string>>;
  data: Uint8Array;
}

export default interface IFileStorageClient {
  preSignUpload(
    payload: IPreSignFileUploadPayload
  ): Promise<IFileUploadInstruction>;

  /** Returns a five-minute signed read URL; rejects signing failures. */
  getDownloadUrl(fileUrl: string): Promise<string>;

  readFile(payload: IReadStoredFilePayload): Promise<IStoredFile | null>;

  deleteFile(key: string): Promise<void>;
}
