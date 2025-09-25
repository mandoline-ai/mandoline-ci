import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

import { getPackageVersion } from '../utils.js';

describe('getPackageVersion', () => {
  it('returns the package.json version for project modules', () => {
    const cliImportMetaUrl = pathToFileURL(
      resolve(process.cwd(), 'src/cli.ts')
    ).toString();
    const version = getPackageVersion(cliImportMetaUrl);

    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    );

    expect(version).toBe(packageJson.version);
  });
});
