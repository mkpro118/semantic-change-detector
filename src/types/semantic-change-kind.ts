/**
 * SemanticChangeKind enumerates the categories of code changes that the
 * analyzer can detect. Each key corresponds to a specific rule and
 * includes a short string tag that is emitted with the change. The
 * documentation for each value explains what it means and why it
 * matters for behavior and tests.
 *
 * Notes
 * - These values are used in user-facing output and in CI annotations.
 * - Treat them as stable identifiers.
 *
 * @library-export
 */
export type SemanticChangeKind = {
  /**
   * arrayMutation — An array is mutated (push, splice, etc.).
   *
   * Order and contents can affect iteration and rendering paths.
   */
  arrayMutation: 'arrayMutation';

  /**
   * asyncAwaitAdded — New async/await usage introduced.
   *
   * Execution order and error surfaces shift to promise semantics.
   */
  asyncAwaitAdded: 'asyncAwaitAdded';

  /**
   * asyncAwaitRemoved — Removed async/await usage.
   *
   * May reintroduce callback or raw promise timing differences.
   */
  asyncAwaitRemoved: 'asyncAwaitRemoved';

  /**
   * classStructureChanged — The shape or members of a class changed.
   *
   * Includes constructor signature updates, method/property visibility,
   * static vs instance changes, or inheritance chain updates.
   */
  classStructureChanged: 'classStructureChanged';

  /**
   * comparisonOperatorChanged — Comparison semantics changed.
   *
   * Includes == vs ===, < vs <=, or direction reversal.
   */
  comparisonOperatorChanged: 'comparisonOperatorChanged';

  /**
   * componentReferenceChanged — The referenced component changed.
   *
   * Example: <X /> becomes <Y />; behavior may differ.
   */
  componentReferenceChanged: 'componentReferenceChanged';

  /**
   * componentStructureChanged — Component structure rearranged.
   *
   * Includes nesting changes that affect render tree and effects.
   */
  componentStructureChanged: 'componentStructureChanged';

  /**
   * conditionalAdded — A new branch or condition was added.
   *
   * New paths require test coverage and may change outcomes.
   */
  conditionalAdded: 'conditionalAdded';

  /**
   * conditionalModified — A condition's expression or structure
   * changed.
   *
   * Alters when code executes (e.g., == vs ===, negations, or combiners).
   */
  conditionalModified: 'conditionalModified';

  /**
   * conditionalRemoved — A branch or condition was removed.
   *
   * Reduces paths; may simplify behavior but could remove safeguards.
   */
  conditionalRemoved: 'conditionalRemoved';

  /**
   * destructuringAdded — New object/array destructuring introduced.
   *
   * Can change variable binding, defaults, and copy-by-value vs ref.
   */
  destructuringAdded: 'destructuringAdded';

  /**
   * destructuringRemoved — Destructuring removed.
   */
  destructuringRemoved: 'destructuringRemoved';

  /**
   * effectAdded — A new effect was introduced.
   */
  effectAdded: 'effectAdded';

  /**
   * effectRemoved — An effect was removed.
   */
  effectRemoved: 'effectRemoved';

  /**
   * eventHandlerChanged — Event handler binding or callback changed.
   */
  eventHandlerChanged: 'eventHandlerChanged';

  /**
   * exportAdded — A new export is now publicly exposed.
   *
   * Even if internal, public surface growth can affect downstream
   * usage and supported API guarantees.
   */
  exportAdded: 'exportAdded';

  /**
   * exportRemoved — A previously exported symbol is no longer exported.
   *
   * This breaks consumers relying on that symbol.
   */
  exportRemoved: 'exportRemoved';

  /**
   * exportSignatureChanged — An exported function/type signature
   * changed.
   *
   * A narrower or broader type, optionality change, or different return
   * type alters the public API contract.
   */
  exportSignatureChanged: 'exportSignatureChanged';

  /**
   * functionAdded — A new function is introduced.
   *
   * Typically reported for exported declarations. Internal utility
   * additions may still indicate new behavior that warrants tests.
   */
  functionAdded: 'functionAdded';

  /**
   * functionCallAdded — A new call site was added.
   *
   * New side effects or data flow can appear.
   */
  functionCallAdded: 'functionCallAdded';

  /**
   * functionCallChanged — A call site changed in a behavior-relevant
   * way.
   *
   * Includes argument add/remove/reorder, replacing literals, or
   * changing callee resolution (e.g., method vs function reference).
   */
  functionCallChanged: 'functionCallChanged';

  /**
   * functionCallModified — A call site is still present but its
   * arguments or callee changed in a meaningful way.
   */
  functionCallModified: 'functionCallModified';

  /**
   * functionCallRemoved — A call site was removed.
   *
   * Side effects may disappear; data flow may change.
   */
  functionCallRemoved: 'functionCallRemoved';

  /**
   * functionComplexityChanged — Cyclomatic complexity meaningfully
   * increased or decreased.
   *
   * A large increase suggests new branches or paths to exercise.
   */
  functionComplexityChanged: 'functionComplexityChanged';

  /**
   * functionRemoved — An existing function is removed.
   *
   * This can break imports and callers. Removing an overload can also
   * alter behavior at call sites.
   */
  functionRemoved: 'functionRemoved';

  /**
   * functionSignatureChanged — A function's public contract changed.
   *
   * Emitted when any of the following are true:
   * - Parameter list meaningfully changes (add/remove/requiredness).
   * - Types for parameters or return type change in a way that affects
   *   callers.
   * - Generic constraints or overloads change.
   *
   * Why this matters
   * - Call sites may fail at compile-time or behave differently at
   *   runtime. This often requires test updates or new tests.
   */
  functionSignatureChanged: 'functionSignatureChanged';

  /**
   * hookAdded — A React hook is newly used.
   *
   * Often impacts render timing or memoization.
   */
  hookAdded: 'hookAdded';

  /**
   * hookDependencyChanged — React hook dependency array changed.
   *
   * Effects, memoization, and callbacks can re-run differently.
   */
  hookDependencyChanged: 'hookDependencyChanged';

  /**
   * hookRemoved — A React hook was removed.
   */
  hookRemoved: 'hookRemoved';

  /**
   * importAdded — A new import appears.
   *
   * This can introduce new runtime dependencies or side effects. Type-
   * only imports are usually ignored as they have no runtime impact.
   */
  importAdded: 'importAdded';

  /**
   * importRemoved — An existing import was removed.
   *
   * May indicate dead code removal or behavior changes if side-effect
   * imports were deleted.
   */
  importRemoved: 'importRemoved';

  /**
   * importStructureChanged — The structure or order of imports changed.
   *
   * Relevant when side-effect imports reorder execution or when
   * specifiers are renamed in a way that affects bindings.
   */
  importStructureChanged: 'importStructureChanged';

  /**
   * interfaceModified — Contract of an interface changed.
   *
   * Adding required members or changing types can break implementers
   * and consumers.
   */
  interfaceModified: 'interfaceModified';

  /**
   * jsxElementAdded — A new JSX element/component is rendered.
   *
   * Can change DOM structure, behavior, or performance.
   */
  jsxElementAdded: 'jsxElementAdded';

  /**
   * jsxElementRemoved — A JSX element/component is no longer rendered.
   */
  jsxElementRemoved: 'jsxElementRemoved';

  /**
   * jsxLogicAdded — New JSX conditional or logical block added.
   */
  jsxLogicAdded: 'jsxLogicAdded';

  /**
   * jsxPropsChanged — Props for a JSX element changed.
   *
   * Prop renames, value changes, or removal can alter behavior.
   */
  jsxPropsChanged: 'jsxPropsChanged';

  /**
   * logicalOperatorChanged — Logical operator or grouping changed.
   *
   * Think: && vs ||, added !, altered precedence.
   */
  logicalOperatorChanged: 'logicalOperatorChanged';

  /**
   * loopAdded — A new loop introduced iteration-based behavior.
   */
  loopAdded: 'loopAdded';

  /**
   * loopModified — Loop bounds or controls changed.
   *
   * Off-by-one and performance impacts are common risks.
   */
  loopModified: 'loopModified';

  /**
   * loopRemoved — A loop was removed, eliminating repeated behavior.
   */
  loopRemoved: 'loopRemoved';

  /**
   * objectMutation — An object's properties are mutated.
   *
   * Mutations can introduce hidden side effects and ordering issues.
   */
  objectMutation: 'objectMutation';

  /**
   * promiseAdded — New promise construction/chain added.
   */
  promiseAdded: 'promiseAdded';

  /**
   * promiseRemoved — Promise usage removed.
   */
  promiseRemoved: 'promiseRemoved';

  /**
   * spreadOperatorAdded — New spread syntax introduced.
   *
   * Can affect copy vs reference behavior and property precedence.
   */
  spreadOperatorAdded: 'spreadOperatorAdded';

  /**
   * spreadOperatorRemoved — Spread usage removed.
   */
  spreadOperatorRemoved: 'spreadOperatorRemoved';

  /**
   * stateManagementChanged — State management usage changed.
   *
   * Example: useState to useReducer, or store wiring changes.
   */
  stateManagementChanged: 'stateManagementChanged';

  /**
   * ternaryAdded — New ternary conditional introduced.
   */
  ternaryAdded: 'ternaryAdded';

  /**
   * ternaryRemoved — Ternary removed.
   */
  ternaryRemoved: 'ternaryRemoved';

  /**
   * throwAdded — New exception throwing added.
   *
   * Changes error handling requirements for callers.
   */
  throwAdded: 'throwAdded';

  /**
   * throwRemoved — Removed explicit exception throwing.
   *
   * May broaden successful paths but also hide failures.
   */
  throwRemoved: 'throwRemoved';

  /**
   * tryCatchAdded — New try/catch or finally block added.
   *
   * Alters error propagation and side effects in failure cases.
   */
  tryCatchAdded: 'tryCatchAdded';

  /**
   * tryCatchModified — Existing error handling was changed.
   *
   * Catch filters, rethrow behavior, or finally semantics differ now.
   */
  tryCatchModified: 'tryCatchModified';

  /**
   * typeDefinitionChanged — A type alias or composite type changed.
   *
   * Includes union/intersection member changes, mapped and template
   * literal updates, or structural reshaping that affects assignability.
   */
  typeDefinitionChanged: 'typeDefinitionChanged';

  /**
   * variableAssignmentChanged — An assignment to a variable changed.
   *
   * Suggests altered data flow or state transitions.
   */
  variableAssignmentChanged: 'variableAssignmentChanged';

  /**
   * variableDeclarationChanged — A variable's declaration changed.
   *
   * Type changes, const vs let, or initializer differences can alter
   * runtime values and mutability.
   */
  variableDeclarationChanged: 'variableDeclarationChanged';
};

export default SemanticChangeKind;
