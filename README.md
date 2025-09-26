# Mandoline CI

Extend CI with Custom Code Evals using the [Mandoline API](http://mandoline.ai).

## Quick Start

### Setup

Get your API key from [mandoline.ai](https://mandoline.ai/account) and configure it based on your usage:

### Configure

Create a configuration file (`mandoline-ci.config.js`) that defines which files to evaluate and what metrics to apply:

```javascript
export default [
  {
    name: 'src',
    files: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
    ignores: ['src/__tests__/**/*'],
    rules: {
      'architecture-consistency': {
        metricId: '4cb434d4-c012-48ac-9a40-19b92d73450e',
        threshold: 0.1,
      },
      'error-regressions': {
        metricId: 'c7efb63f-3b6d-4b32-9dc6-04bddc8ebabc',
        threshold: 0.2,
        scoreObjective: 'minimize', // lower score indicates fewer regressions
      },
      // and so on...
    },
  },
];
```

Omit `scoreObjective` to use the default `'maximize'` behavior (higher scores pass). Set it to `'minimize'` when Mandoline should treat lower scores as better.

See this repo's [configuration](https://github.com/mandoline-ai/mandoline-ci/blob/main/mandoline-ci.config.mjs) for a complete example.

### Use

#### In CI

Add `MANDOLINE_API_KEY` as a repository secret in Settings > Secrets and variables > Actions, then add as a job in your CI workflow.

For example, to add as a job that runs after tests pass:

```yaml
jobs:
  test:
    # Your existing test job
    runs-on: ubuntu-latest
    steps:
      # ... your test steps

  mandoline-eval:
    name: Mandoline Evaluation
    runs-on: ubuntu-latest
    needs: test
    if: success()

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required for git diff analysis between base and head

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build project
        run: npm run build

      - name: Run Mandoline evaluation
        env:
          MANDOLINE_API_KEY: ${{ secrets.MANDOLINE_API_KEY }}
        run: npx mandoline-ci run --verbose
```

See this repo's [CI workflow](https://github.com/mandoline-ai/mandoline-ci/blob/main/.github/workflows/ci.yml) for a complete example.

#### Via CLI

Install globally and set your API key, then run for local development or manual evaluation:

```bash
npm install -g mandoline-ci
export MANDOLINE_API_KEY="sk_****"
```

```bash
# Basic evaluation
mandoline-ci run

# Custom branches
mandoline-ci run --base develop --head feature/auth

# Explicitly specify intent
mandoline-ci run --intent "Implement user authentication"

# Validate setup
mandoline-ci validate

# Debug mode
mandoline-ci run --verbose
```

#### Programmatically

Install as a dependency and configure the client:

```typescript
import { MandolineCI } from 'mandoline-ci';

const client = new MandolineCI({
  apiKey: 'sk_****', // or omit and set MANDOLINE_API_KEY env var
  workingDirectory: '/path/to/project',
});

const results = await client.evaluateDiff({
  base: 'main',
  head: 'HEAD',
  intent: 'Implement user authentication',
});
```

## License

[Apache 2.0](https://github.com/mandoline-ai/mandoline-ci/blob/main/LICENSE)
