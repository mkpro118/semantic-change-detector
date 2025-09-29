# Configuration System

The semantic change detector supports a powerful, production-ready configuration system that provides granular control over change detection, severity assignments, and analyzer performance.

## Configuration File

Place your configuration in `.semantic-change-detector.json` in your project root, or specify a custom path using `--config-path`.

## Key Features

### 1. Change Kind Groups

Changes are organized into logical groups that can be enabled/disabled as units:

- **async-patterns**: Promises, async/await, effects
- **complexity**: Complexity metrics and spread operators
- **control-flow**: Conditionals, loops, try-catch, logical operators
- **core-structural**: Functions, classes, exports, interfaces - core API changes
- **data-flow**: Variables, assignments, mutations, destructuring
- **error-handling**: Try-catch, throw statements
- **imports-exports**: Import/export structure changes
- **jsx-logic**: JSX logical expressions, event handlers
- **jsx-rendering**: JSX elements, props, conditional rendering
- **react-hooks**: All React hook related changes
- **side-effects**: Function calls, mutations, side effect imports
- **type-system**: Type definitions, interfaces (type-only changes)

### 2. Configurable Severities

Override default severity levels for any change kind:

```json
{
  "severityOverrides": {
    "importAdded": "medium", // Treat new imports as medium severity
    "jsxElementAdded": "high" // Treat new JSX elements as high severity
  }
}
```

### 3. JSX-Specific Controls

Special handling for JSX changes since they're often not semantic:

```json
{
  "jsxConfig": {
    "enabled": true,
    "ignoreLogicChanges": true, // Don't flag "isLoading ? 'Loading' : 'Load More'"
    "treatAsLowSeverity": false, // Override all JSX to low severity
    "eventHandlerComplexityThreshold": 3 // Only flag complex event handlers
  }
}
```

### 4. Test Requirements

Fine-grained control over when tests are required:

```json
{
  "testRequirements": {
    "alwaysRequireTests": ["functionSignatureChanged", "exportRemoved"],
    "neverRequireTests": ["jsxLogicAdded", "eventHandlerChanged"],
    "minimumSeverityForTests": "medium" // Require tests for medium+ severity
  }
}
```

### 5. Performance Optimizations

Control analyzer execution for better performance:

```json
{
  "performance": {
    "skipDisabledAnalyzers": true, // Don't run analyzers for disabled groups
    "enableEarlyExit": true // Exit early when no changes detected
  }
}
```

## Default Configuration

The system ships with carefully chosen defaults optimized for real-world usage:

- **JSX logic changes disabled by default** - Conditional rendering like `isLoading ? 'Loading' : 'Load More'` is not flagged
- **Critical changes require tests** - Function signatures, exports, class structures always require tests
- **Granular severity levels** - 50+ change types with appropriate severity assignments
- **Performance optimized** - Selective analyzer execution and early exit optimizations

## Example Configuration

```json
{
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["**/*.test.*", "node_modules/**"],

  "changeKindGroups": {
    "enabled": ["core-structural", "data-flow", "react-hooks"],
    "disabled": ["jsx-logic", "complexity"]
  },

  "severityOverrides": {
    "importAdded": "medium"
  },

  "disabledChangeKinds": ["spreadOperatorAdded"],

  "jsxConfig": {
    "enabled": true,
    "ignoreLogicChanges": true,
    "treatAsLowSeverity": false,
    "eventHandlerComplexityThreshold": 5
  },

  "testRequirements": {
    "alwaysRequireTests": ["functionSignatureChanged"],
    "neverRequireTests": ["jsxLogicAdded"],
    "minimumSeverityForTests": "high"
  }
}
```

## Common Use Cases

### Teams that don't test JSX logic

```json
{
  "changeKindGroups": { "disabled": ["jsx-logic"] },
  "jsxConfig": { "ignoreLogicChanges": true }
}
```

### Strict dependency tracking

```json
{
  "severityOverrides": { "importAdded": "high" },
  "testRequirements": { "alwaysRequireTests": ["importAdded"] }
}
```

### Performance-focused (large codebases)

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

### UI-heavy projects

```json
{
  "jsxConfig": { "treatAsLowSeverity": true },
  "changeKindGroups": { "disabled": ["jsx-logic", "jsx-rendering"] }
}
```
