import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const SRC = resolve(import.meta.dirname, '../src');
const LAYERS = [
  'domain',
  'application',
  'infrastructure',
  'presentation',
] as const;
type Layer = (typeof LAYERS)[number];

// Dependency rule: each layer may only depend on the layers listed here.
const ALLOWED: Record<Layer, Layer[]> = {
  domain: ['domain'],
  application: ['domain', 'application'],
  infrastructure: ['domain', 'application', 'infrastructure'],
  presentation: ['domain', 'application', 'presentation'],
};

const FRAMEWORK_FREE: Layer[] = ['domain', 'application'];

// Packages the domain/application layers must never reach for.
const FORBIDDEN_IN_CORE = [/^@nestjs\//, /^typeorm/, /^pg$/, /^express$/];

interface SourceFile {
  path: string;
  module: string; // "users", "shared", ...
  layer: Layer | null;
  imports: string[];
}

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });

const describeFile = (path: string): Omit<SourceFile, 'imports'> => {
  const parts = relative(SRC, path).split(sep);
  const module = parts[0] === 'modules' ? parts[1] : parts[0];
  const rest = parts[0] === 'modules' ? parts.slice(2) : parts.slice(1);
  const layer = (LAYERS as readonly string[]).includes(rest[0])
    ? (rest[0] as Layer)
    : null;
  return { path, module, layer };
};

const files: SourceFile[] = listFiles(SRC).map((path) => ({
  ...describeFile(path),
  imports: [
    ...readFileSync(path, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g),
  ].map((match) => match[1]),
}));

describe('Architecture', () => {
  const layered = files.filter((file) => file.layer);

  it.each(layered.map((file) => [relative(SRC, file.path), file] as const))(
    '%s respects the dependency rule',
    (_name, file) => {
      for (const specifier of file.imports) {
        if (!specifier.startsWith('.')) {
          if (FRAMEWORK_FREE.includes(file.layer!)) {
            for (const forbidden of FORBIDDEN_IN_CORE) {
              expect(
                specifier,
                `${file.layer} must be framework-free ("${specifier}")`,
              ).not.toMatch(forbidden);
            }
          }
          continue;
        }

        const target = describeFile(resolve(dirname(file.path), specifier));

        if (target.module !== file.module && target.module !== 'shared') {
          throw new Error(
            `"${specifier}" crosses into module "${target.module}"; modules must not import each other's internals`,
          );
        }

        if (target.layer && target.module === file.module) {
          expect(
            ALLOWED[file.layer!],
            `${file.layer} must not depend on ${target.layer} ("${specifier}")`,
          ).toContain(target.layer);
        }
      }
    },
  );
});
