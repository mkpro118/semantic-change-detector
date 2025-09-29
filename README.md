# @mkpro118/semantic-change-detector

Advanced semantic change detection for TypeScript and React code with GitHub Actions integration.

## What it does

The semantic change detector analyzes your TypeScript and React code changes to automatically determine when you need to write tests. Unlike simple diff tools, it understands the **meaning** of your changes - distinguishing between cosmetic changes (like formatting) and semantic changes (like new function parameters or React hook dependencies).

Perfect for teams who want to:
- **Automate test requirement decisions** in pull requests
- **Focus testing efforts** on changes that actually matter
- **Avoid over-testing** trivial changes like formatting or comments
- **Ensure critical changes** like API modifications get proper test coverage

## Key Features

- **50+ semantic change types** including function signatures, React hooks, JSX logic, and more
- **Smart severity classification** - distinguishes between critical, moderate, and trivial changes
- **GitHub Actions integration** - automated PR comments and file annotations
- **Highly configurable** - tune detection rules for your team's workflow
- **Zero dependencies** - only TypeScript as peer dependency

## Quick Start

### Basic CLI Usage

```bash
# Analyze specific files
npx semantic-change-detector \
  --base-ref=main \
  --head-ref=feature-branch \
  --files="src/component.tsx,src/utils.ts"

# Analyze all changed files from git diff
git diff --name-only main...HEAD | npx semantic-change-detector \
  --stdin \
  --base-ref=main \
  --head-ref=HEAD
```

### Example Output

```
Analysis Results:
   Files analyzed: 3
   Total changes: 8
   High severity: 2
   Medium severity: 4
   Low severity: 2
   Tests required: Yes

Top change types:
   functionSignatureChanged: 1 (high)
   hookDependencyChanged: 1 (high)
   jsxPropsChanged: 3 (low)
   importAdded: 3 (low)
```

## What Gets Detected

The analyzer detects semantic changes across several categories. Here are some key examples:

**High Severity (Require Tests)**
- `functionSignatureChanged` - Function parameters or return types changed
- `hookDependencyChanged` - React hook dependency arrays modified
- `conditionalAdded` - New if statements or conditional logic
- `exportRemoved` - Public API breaking changes

**Medium Severity (May Require Tests)**
- `hookAdded` - New React hooks introduced
- `jsxLogicAdded` - New conditional rendering logic
- `functionCallAdded` - New function calls (potential side effects)

**Low Severity (Usually Safe)**
- `importAdded` - New imports (unless side-effectful)
- `jsxElementAdded` - New JSX elements
- `variableDeclarationChanged` - Variable type or initialization changes

For a complete reference of all 50+ change types, see [docs/semantic-change-kinds.md](docs/semantic-change-kinds.md).

## CLI Reference

### Required Options
- `--base-ref=<ref>` - Git reference for the base version (e.g., `main`, `HEAD~1`)
- `--head-ref=<ref>` - Git reference for the head version (e.g., `feature-branch`, `HEAD`)

### Input Options (choose one)
- `--files=<paths>` - Comma-separated list of file paths to analyze
- `--stdin` - Read file paths from stdin (newline-separated)

### Output Options
- `--output-format=<format>` - Output format (default: auto-detected)
  - `console` - Human-readable summary for terminals
  - `json` - JSON output written to `--output-file`
  - `machine` - JSON output to stdout (for piping)
  - `github-actions` - GitHub Actions annotations and comments
- `--output-file=<path>` - File path for JSON output (used with `json` format)

### Control Options
- `--debug` - Enable verbose debug logging
- `--quiet` - Suppress all output except critical errors
- `--timeout-ms=<ms>` - Timeout for individual file analysis (default: 120000)
- `--config-path=<path>` - Path to configuration file (default: `.semantic-change-detector.json`)

### Examples

```bash
# Basic analysis
npx semantic-change-detector --base-ref=main --head-ref=HEAD --files="src/app.tsx"

# Get JSON output
npx semantic-change-detector \
  --base-ref=main --head-ref=HEAD \
  --files="src/app.tsx" \
  --output-format=json \
  --output-file=analysis.json

# Pipe from git diff
git diff --name-only main...HEAD | npx semantic-change-detector \
  --stdin --base-ref=main --head-ref=HEAD

# Analyze with custom config
npx semantic-change-detector \
  --base-ref=main --head-ref=HEAD \
  --files="src/app.tsx" \
  --config-path=.my-semantic-config.json
```

## Configuration

The analyzer is highly configurable to match your team's needs. Create a `.semantic-change-detector.json` file in your project root:

### Basic Configuration

```json
{
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/*.test.*", "node_modules/**"],
  "testGlobs": ["**/*.test.*", "**/*.spec.*"],
  "bypassLabels": ["skip-tests", "docs-only"]
}
```

### Advanced Configuration

```json
{
  "changeKindGroups": {
    "enabled": ["core-structural", "react-hooks", "side-effects"],
    "disabled": ["jsx-logic", "complexity"]
  },
  "severityOverrides": {
    "importAdded": "medium",
    "jsxElementAdded": "high"
  },
  "jsxConfig": {
    "enabled": true,
    "ignoreLogicChanges": true,
    "treatAsLowSeverity": false
  },
  "testRequirements": {
    "alwaysRequireTests": ["functionSignatureChanged"],
    "neverRequireTests": ["jsxLogicAdded"],
    "minimumSeverityForTests": "medium"
  }
}
```

For complete configuration documentation, see [CONFIGURATION.md](CONFIGURATION.md).

## GitHub Actions Integration

Add semantic analysis to your PR workflow:

```yaml
name: Semantic Change Analysis
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  semantic-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run semantic analysis
        run: |
          file_patterns=(
            '*.js'
            '*.jsx'
            '*.ts'
            '*.tsx'
          )
          base_ref="${{ github.event.pull_request.base.sha }}"
          head_ref="${{ github.event.pull_request.head.sha }}"
          git diff --name-only --relative $base_ref...$head_ref -- "${file_patterns[@]}" | \
            npx semantic-change-detector \
            --stdin \
            --base-ref="$base_ref" \
            --head-ref="$head_ref" \
            --output-format=github-actions
```

This will automatically:
- Add file annotations showing detected changes
- Create PR comments with analysis summaries
- Set check status based on whether tests are required
- Provide recommendations for test coverage

## Programmatic Usage

### Installation

```bash
npm install @mkpro118/semantic-change-detector
```

```typescript
import { runSemanticAnalysis } from '@mkpro118/semantic-change-detector';

const result = await runSemanticAnalysis({
  baseRef: 'main',
  headRef: 'feature-branch',
  files: ['src/component.tsx', 'src/utils.ts'],
  outputFormat: 'json',
});

console.log(`Found ${result.totalChanges} changes`);
console.log(`Tests required: ${result.requiresTests}`);

// Access individual changes
result.changes.forEach(change => {
  console.log(`${change.file}:${change.line} - ${change.kind} (${change.severity})`);
});
```

## Output Formats

### Console Format (Default)
Human-readable summary suitable for local development:

```
Analysis Results:
   Files analyzed: 2
   Total changes: 6
   High severity: 1
   Medium severity: 2
   Low severity: 3
   Tests required: Yes

Top change types:
   functionSignatureChanged: 1 (high)
   hookAdded: 1 (medium)
   importAdded: 2 (low)
```

### JSON Format
Structured output for tooling integration:

```json
{
  "requiresTests": true,
  "summary": "6 semantic changes detected, 1 high-severity, 2 medium-severity, 3 low-severity, Tests required",
  "filesAnalyzed": 2,
  "totalChanges": 6,
  "severityBreakdown": {
    "high": 1,
    "medium": 2,
    "low": 3
  },
  "changes": [
    {
      "file": "src/utils.ts",
      "line": 42,
      "column": 0,
      "kind": "functionSignatureChanged",
      "severity": "high",
      "detail": "Function signature changed: add parameter count changed from 2 to 3"
    }
  ]
}
```

### GitHub Actions Format
Generates GitHub Actions workflow commands:

```
::error file=src/utils.ts,line=42,title=functionSignatureChanged::Function signature changed: add parameter count changed from 2 to 3
::warning file=src/hooks.ts,line=15,title=hookAdded::React hook added: useCallback
::notice file=src/types.ts,line=8,title=importAdded::Import added: lodash
```

## Common Use Cases

### Strict Dependency Tracking
Flag all new imports as requiring review:

```json
{
  "severityOverrides": {
    "importAdded": "high"
  },
  "testRequirements": {
    "alwaysRequireTests": ["importAdded"]
  }
}
```

### UI-Heavy Projects
Treat JSX changes as low priority:

```json
{
  "jsxConfig": {
    "treatAsLowSeverity": true,
    "ignoreLogicChanges": true
  },
  "changeKindGroups": {
    "disabled": ["jsx-logic"]
  }
}
```

### Performance-Focused
Skip expensive analysis for large codebases:

```json
{
  "performance": {
    "skipDisabledAnalyzers": true,
    "enableEarlyExit": true
  },
  "changeKindGroups": {
    "disabled": ["complexity", "type-system"]
  }
}
```

## Support

- [Report Issues](https://github.com/mkpro118/semantic-change-detector/issues)
- [Configuration Guide](CONFIGURATION.md)
- [Change Types Reference](docs/semantic-change-kinds.md)

## License

MIT License - see [LICENSE](LICENSE) file for details.
