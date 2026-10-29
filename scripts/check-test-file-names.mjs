import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const ROOTS = ['src', 'test'];
const TEST_SUFFIXES = ['.test.ts', '.spec.ts'];
const TEST_DIRS = new Set(['__tests__', '__test__', '__specs__', '__spec__']);

const walk = (root) => {
  const entries = readdirSync(root, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'coverage'
      ) {
        return [];
      }

      return walk(entryPath);
    }

    return [entryPath];
  });
};

const normalizePath = (filePath) => filePath.split(sep).join('/');

const isTestFile = (filePath) => {
  const normalizedPath = normalizePath(filePath);

  return (
    TEST_SUFFIXES.some((suffix) => normalizedPath.endsWith(suffix)) ||
    normalizedPath.split('/').some((segment) => TEST_DIRS.has(segment))
  );
};

const isDependencyFreePath = (normalizedPath) => {
  const segments = normalizedPath.split('/');
  const fileName = segments.at(-1) ?? '';

  if (normalizedPath.startsWith('test/')) {
    return false;
  }

  if (
    segments.includes('dtos') ||
    segments.includes('mappers') ||
    fileName.includes('.mapper.')
  ) {
    return true;
  }

  return (
    normalizedPath.startsWith('src/domain/') ||
    normalizedPath.startsWith('src/shared/')
  );
};

const expectedNamingFor = (normalizedPath) => {
  const isColocatedReportingSpec =
    /^src\/app\/[^/]+\/usecases\/reporting\/([^/]+)\/\1\.spec\.ts$/.test(
      normalizedPath
    );

  if (normalizedPath.startsWith('test/') || isColocatedReportingSpec) {
    return { directory: null, suffix: '.spec.ts' };
  }

  if (isDependencyFreePath(normalizedPath)) {
    return { directory: '__tests__', suffix: '.test.ts' };
  }

  return { directory: '__specs__', suffix: '.spec.ts' };
};

const buildExpectedPath = (normalizedPath, expected) => {
  const segments = normalizedPath.split('/');
  const fileName = segments.at(-1) ?? '';
  const currentDirIndex = segments.findIndex((segment) =>
    TEST_DIRS.has(segment)
  );
  const expectedFileName = fileName
    .replace(/\.test\.ts$/, expected.suffix)
    .replace(/\.spec\.ts$/, expected.suffix);

  if (currentDirIndex !== -1) {
    if (expected.directory === null) {
      segments.splice(currentDirIndex, 1);
    } else {
      segments[currentDirIndex] = expected.directory;
    }

    segments[segments.length - 1] = expectedFileName;

    return segments.join('/');
  }

  if (expected.directory === null) {
    segments[segments.length - 1] = expectedFileName;

    return segments.join('/');
  }

  const insertionIndex = Math.max(segments.length - 1, 0);
  const nextSegments = [...segments];

  nextSegments.splice(insertionIndex, 0, expected.directory);
  nextSegments[nextSegments.length - 1] = expectedFileName;

  return nextSegments.join('/');
};

const getMismatches = () => {
  const files = ROOTS.flatMap((root) => walk(root))
    .map(normalizePath)
    .filter(isTestFile);

  return files.flatMap((filePath) => {
    const expected = expectedNamingFor(filePath);
    const segments = filePath.split('/');
    const currentDir = segments.find((segment) => TEST_DIRS.has(segment));
    const reasons = [];

    if (expected.directory === null) {
      if (currentDir) {
        reasons.push(`expected no test directory but found ${currentDir}`);
      }
    } else if (currentDir !== expected.directory) {
      reasons.push(
        `expected directory ${expected.directory} but found ${currentDir ?? 'none'}`
      );
    }

    if (!filePath.endsWith(expected.suffix)) {
      reasons.push(`expected suffix ${expected.suffix}`);
    }

    if (reasons.length === 0) {
      return [];
    }

    return [
      {
        actualPath: filePath,
        expectedPath: buildExpectedPath(filePath, expected),
        reasons,
      },
    ];
  });
};

const mismatches = getMismatches();

if (mismatches.length === 0) {
  console.log('All test files match the naming convention.');
  process.exit(0);
}

console.error('Test naming mismatches found:\n');

for (const mismatch of mismatches) {
  console.error(`- ${mismatch.actualPath}`);
  console.error(`  Expected: ${mismatch.expectedPath}`);
  console.error(`  Reason: ${mismatch.reasons.join('; ')}`);
}

process.exit(1);
