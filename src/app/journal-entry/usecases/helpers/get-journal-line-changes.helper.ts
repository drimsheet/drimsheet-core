import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';

/** Compares audited journal snapshots by line ID and version for persistence. */
export default function getJournalLineChangesHelper(
  originalLines: readonly IJournalLine[],
  updatedLines: readonly IJournalLine[]
) {
  const originalVersions = new Map(
    originalLines.map((line) => [line.id, line.version])
  );
  const updatedLineIds = new Set(updatedLines.map((line) => line.id));

  return {
    linesToCreate: updatedLines.filter(
      (line) => !originalVersions.has(line.id)
    ),
    linesToUpdate: updatedLines.filter((line) => {
      const originalVersion = originalVersions.get(line.id);
      return originalVersion !== undefined && line.version !== originalVersion;
    }),
    lineIdsToDelete: originalLines
      .filter((line) => !updatedLineIds.has(line.id))
      .map((line) => line.id),
  };
}
