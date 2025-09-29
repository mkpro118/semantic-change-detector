# SemanticChangeKind Reference

This document is generated from `src/types/semantic-change-kind.ts` and describes each `SemanticChangeKind` entry and its emitted tag.

## Index

- [arrayMutation](#arraymutation)
- [asyncAwaitAdded](#asyncawaitadded)
- [asyncAwaitRemoved](#asyncawaitremoved)
- [classStructureChanged](#classstructurechanged)
- [comparisonOperatorChanged](#comparisonoperatorchanged)
- [componentReferenceChanged](#componentreferencechanged)
- [componentStructureChanged](#componentstructurechanged)
- [conditionalAdded](#conditionaladded)
- [conditionalModified](#conditionalmodified)
- [conditionalRemoved](#conditionalremoved)
- [destructuringAdded](#destructuringadded)
- [destructuringRemoved](#destructuringremoved)
- [effectAdded](#effectadded)
- [effectRemoved](#effectremoved)
- [eventHandlerChanged](#eventhandlerchanged)
- [exportAdded](#exportadded)
- [exportRemoved](#exportremoved)
- [exportSignatureChanged](#exportsignaturechanged)
- [functionAdded](#functionadded)
- [functionCallAdded](#functioncalladded)
- [functionCallChanged](#functioncallchanged)
- [functionCallModified](#functioncallmodified)
- [functionCallRemoved](#functioncallremoved)
- [functionComplexityChanged](#functioncomplexitychanged)
- [functionRemoved](#functionremoved)
- [functionSignatureChanged](#functionsignaturechanged)
- [hookAdded](#hookadded)
- [hookDependencyChanged](#hookdependencychanged)
- [hookRemoved](#hookremoved)
- [importAdded](#importadded)
- [importRemoved](#importremoved)
- [importStructureChanged](#importstructurechanged)
- [interfaceModified](#interfacemodified)
- [jsxElementAdded](#jsxelementadded)
- [jsxElementRemoved](#jsxelementremoved)
- [jsxLogicAdded](#jsxlogicadded)
- [jsxPropsChanged](#jsxpropschanged)
- [logicalOperatorChanged](#logicaloperatorchanged)
- [loopAdded](#loopadded)
- [loopModified](#loopmodified)
- [loopRemoved](#loopremoved)
- [objectMutation](#objectmutation)
- [promiseAdded](#promiseadded)
- [promiseRemoved](#promiseremoved)
- [sideEffectImportAdded](#sideeffectimportadded)
- [spreadOperatorAdded](#spreadoperatoradded)
- [spreadOperatorRemoved](#spreadoperatorremoved)
- [stateManagementChanged](#statemanagementchanged)
- [ternaryAdded](#ternaryadded)
- [ternaryRemoved](#ternaryremoved)
- [throwAdded](#throwadded)
- [throwRemoved](#throwremoved)
- [tryCatchAdded](#trycatchadded)
- [tryCatchModified](#trycatchmodified)
- [typeDefinitionChanged](#typedefinitionchanged)
- [variableAssignmentChanged](#variableassignmentchanged)
- [variableDeclarationChanged](#variabledeclarationchanged)

## arrayMutation

- Tag: `arrayMutation`
- Source: [src/types/semantic-change-kind.ts#L15](/src/types/semantic-change-kind.ts#L15)

arrayMutation — An array is mutated (push, splice, etc.).

Order and contents can affect iteration and rendering paths.

## asyncAwaitAdded

- Tag: `asyncAwaitAdded`
- Source: [src/types/semantic-change-kind.ts#L22](/src/types/semantic-change-kind.ts#L22)

asyncAwaitAdded — New async/await usage introduced.

Execution order and error surfaces shift to promise semantics.

## asyncAwaitRemoved

- Tag: `asyncAwaitRemoved`
- Source: [src/types/semantic-change-kind.ts#L29](/src/types/semantic-change-kind.ts#L29)

asyncAwaitRemoved — Removed async/await usage.

May reintroduce callback or raw promise timing differences.

## classStructureChanged

- Tag: `classStructureChanged`
- Source: [src/types/semantic-change-kind.ts#L36](/src/types/semantic-change-kind.ts#L36)

classStructureChanged — The shape or members of a class changed.

Includes constructor signature updates, method/property visibility,
static vs instance changes, or inheritance chain updates.

## comparisonOperatorChanged

- Tag: `comparisonOperatorChanged`
- Source: [src/types/semantic-change-kind.ts#L44](/src/types/semantic-change-kind.ts#L44)

comparisonOperatorChanged — Comparison semantics changed.

Includes == vs ===, < vs <=, or direction reversal.

## componentReferenceChanged

- Tag: `componentReferenceChanged`
- Source: [src/types/semantic-change-kind.ts#L51](/src/types/semantic-change-kind.ts#L51)

componentReferenceChanged — The referenced component changed.

Example: <X /> becomes <Y />; behavior may differ.

## componentStructureChanged

- Tag: `componentStructureChanged`
- Source: [src/types/semantic-change-kind.ts#L58](/src/types/semantic-change-kind.ts#L58)

componentStructureChanged — Component structure rearranged.

Includes nesting changes that affect render tree and effects.

## conditionalAdded

- Tag: `conditionalAdded`
- Source: [src/types/semantic-change-kind.ts#L65](/src/types/semantic-change-kind.ts#L65)

conditionalAdded — A new branch or condition was added.

New paths require test coverage and may change outcomes.

## conditionalModified

- Tag: `conditionalModified`
- Source: [src/types/semantic-change-kind.ts#L72](/src/types/semantic-change-kind.ts#L72)

conditionalModified — A condition's expression or structure
changed.

Alters when code executes (e.g., == vs ===, negations, or combiners).

## conditionalRemoved

- Tag: `conditionalRemoved`
- Source: [src/types/semantic-change-kind.ts#L80](/src/types/semantic-change-kind.ts#L80)

conditionalRemoved — A branch or condition was removed.

Reduces paths; may simplify behavior but could remove safeguards.

## destructuringAdded

- Tag: `destructuringAdded`
- Source: [src/types/semantic-change-kind.ts#L87](/src/types/semantic-change-kind.ts#L87)

destructuringAdded — New object/array destructuring introduced.

Can change variable binding, defaults, and copy-by-value vs ref.

## destructuringRemoved

- Tag: `destructuringRemoved`
- Source: [src/types/semantic-change-kind.ts#L94](/src/types/semantic-change-kind.ts#L94)

destructuringRemoved — Destructuring removed.

## effectAdded

- Tag: `effectAdded`
- Source: [src/types/semantic-change-kind.ts#L99](/src/types/semantic-change-kind.ts#L99)

effectAdded — A new effect was introduced.

## effectRemoved

- Tag: `effectRemoved`
- Source: [src/types/semantic-change-kind.ts#L104](/src/types/semantic-change-kind.ts#L104)

effectRemoved — An effect was removed.

## eventHandlerChanged

- Tag: `eventHandlerChanged`
- Source: [src/types/semantic-change-kind.ts#L109](/src/types/semantic-change-kind.ts#L109)

eventHandlerChanged — Event handler binding or callback changed.

## exportAdded

- Tag: `exportAdded`
- Source: [src/types/semantic-change-kind.ts#L114](/src/types/semantic-change-kind.ts#L114)

exportAdded — A new export is now publicly exposed.

Even if internal, public surface growth can affect downstream
usage and supported API guarantees.

## exportRemoved

- Tag: `exportRemoved`
- Source: [src/types/semantic-change-kind.ts#L122](/src/types/semantic-change-kind.ts#L122)

exportRemoved — A previously exported symbol is no longer exported.

This breaks consumers relying on that symbol.

## exportSignatureChanged

- Tag: `exportSignatureChanged`
- Source: [src/types/semantic-change-kind.ts#L129](/src/types/semantic-change-kind.ts#L129)

exportSignatureChanged — An exported function/type signature
changed.

A narrower or broader type, optionality change, or different return
type alters the public API contract.

## functionAdded

- Tag: `functionAdded`
- Source: [src/types/semantic-change-kind.ts#L138](/src/types/semantic-change-kind.ts#L138)

functionAdded — A new function is introduced.

Typically reported for exported declarations. Internal utility
additions may still indicate new behavior that warrants tests.

## functionCallAdded

- Tag: `functionCallAdded`
- Source: [src/types/semantic-change-kind.ts#L146](/src/types/semantic-change-kind.ts#L146)

functionCallAdded — A new call site was added.

New side effects or data flow can appear.

## functionCallChanged

- Tag: `functionCallChanged`
- Source: [src/types/semantic-change-kind.ts#L153](/src/types/semantic-change-kind.ts#L153)

functionCallChanged — A call site changed in a behavior-relevant
way.

Includes argument add/remove/reorder, replacing literals, or
changing callee resolution (e.g., method vs function reference).

## functionCallModified

- Tag: `functionCallModified`
- Source: [src/types/semantic-change-kind.ts#L162](/src/types/semantic-change-kind.ts#L162)

functionCallModified — A call site is still present but its
arguments or callee changed in a meaningful way.

## functionCallRemoved

- Tag: `functionCallRemoved`
- Source: [src/types/semantic-change-kind.ts#L168](/src/types/semantic-change-kind.ts#L168)

functionCallRemoved — A call site was removed.

Side effects may disappear; data flow may change.

## functionComplexityChanged

- Tag: `functionComplexityChanged`
- Source: [src/types/semantic-change-kind.ts#L175](/src/types/semantic-change-kind.ts#L175)

functionComplexityChanged — Cyclomatic complexity meaningfully
increased or decreased.

A large increase suggests new branches or paths to exercise.

## functionRemoved

- Tag: `functionRemoved`
- Source: [src/types/semantic-change-kind.ts#L183](/src/types/semantic-change-kind.ts#L183)

functionRemoved — An existing function is removed.

This can break imports and callers. Removing an overload can also
alter behavior at call sites.

## functionSignatureChanged

- Tag: `functionSignatureChanged`
- Source: [src/types/semantic-change-kind.ts#L191](/src/types/semantic-change-kind.ts#L191)

functionSignatureChanged — A function's public contract changed.

Emitted when any of the following are true:
- Parameter list meaningfully changes (add/remove/requiredness).
- Types for parameters or return type change in a way that affects
  callers.
- Generic constraints or overloads change.

Why this matters
- Call sites may fail at compile-time or behave differently at
  runtime. This often requires test updates or new tests.

## hookAdded

- Tag: `hookAdded`
- Source: [src/types/semantic-change-kind.ts#L206](/src/types/semantic-change-kind.ts#L206)

hookAdded — A React hook is newly used.

Often impacts render timing or memoization.

## hookDependencyChanged

- Tag: `hookDependencyChanged`
- Source: [src/types/semantic-change-kind.ts#L213](/src/types/semantic-change-kind.ts#L213)

hookDependencyChanged — React hook dependency array changed.

Effects, memoization, and callbacks can re-run differently.

## hookRemoved

- Tag: `hookRemoved`
- Source: [src/types/semantic-change-kind.ts#L220](/src/types/semantic-change-kind.ts#L220)

hookRemoved — A React hook was removed.

## importAdded

- Tag: `importAdded`
- Source: [src/types/semantic-change-kind.ts#L225](/src/types/semantic-change-kind.ts#L225)

importAdded — A new import appears.

This can introduce new runtime dependencies or side effects. Type-
only imports are usually ignored as they have no runtime impact.

## importRemoved

- Tag: `importRemoved`
- Source: [src/types/semantic-change-kind.ts#L233](/src/types/semantic-change-kind.ts#L233)

importRemoved — An existing import was removed.

May indicate dead code removal or behavior changes if side-effect
imports were deleted.

## importStructureChanged

- Tag: `importStructureChanged`
- Source: [src/types/semantic-change-kind.ts#L241](/src/types/semantic-change-kind.ts#L241)

importStructureChanged — The structure or order of imports changed.

Relevant when side-effect imports reorder execution or when
specifiers are renamed in a way that affects bindings.

## interfaceModified

- Tag: `interfaceModified`
- Source: [src/types/semantic-change-kind.ts#L256](/src/types/semantic-change-kind.ts#L256)

interfaceModified — Contract of an interface changed.

Adding required members or changing types can break implementers
and consumers.

## jsxElementAdded

- Tag: `jsxElementAdded`
- Source: [src/types/semantic-change-kind.ts#L264](/src/types/semantic-change-kind.ts#L264)

jsxElementAdded — A new JSX element/component is rendered.

Can change DOM structure, behavior, or performance.

## jsxElementRemoved

- Tag: `jsxElementRemoved`
- Source: [src/types/semantic-change-kind.ts#L271](/src/types/semantic-change-kind.ts#L271)

jsxElementRemoved — A JSX element/component is no longer rendered.

## jsxLogicAdded

- Tag: `jsxLogicAdded`
- Source: [src/types/semantic-change-kind.ts#L276](/src/types/semantic-change-kind.ts#L276)

jsxLogicAdded — New JSX conditional or logical block added.

## jsxPropsChanged

- Tag: `jsxPropsChanged`
- Source: [src/types/semantic-change-kind.ts#L281](/src/types/semantic-change-kind.ts#L281)

jsxPropsChanged — Props for a JSX element changed.

Prop renames, value changes, or removal can alter behavior.

## logicalOperatorChanged

- Tag: `logicalOperatorChanged`
- Source: [src/types/semantic-change-kind.ts#L288](/src/types/semantic-change-kind.ts#L288)

logicalOperatorChanged — Logical operator or grouping changed.

Think: && vs ||, added !, altered precedence.

## loopAdded

- Tag: `loopAdded`
- Source: [src/types/semantic-change-kind.ts#L295](/src/types/semantic-change-kind.ts#L295)

loopAdded — A new loop introduced iteration-based behavior.

## loopModified

- Tag: `loopModified`
- Source: [src/types/semantic-change-kind.ts#L300](/src/types/semantic-change-kind.ts#L300)

loopModified — Loop bounds or controls changed.

Off-by-one and performance impacts are common risks.

## loopRemoved

- Tag: `loopRemoved`
- Source: [src/types/semantic-change-kind.ts#L307](/src/types/semantic-change-kind.ts#L307)

loopRemoved — A loop was removed, eliminating repeated behavior.

## objectMutation

- Tag: `objectMutation`
- Source: [src/types/semantic-change-kind.ts#L312](/src/types/semantic-change-kind.ts#L312)

objectMutation — An object's properties are mutated.

Mutations can introduce hidden side effects and ordering issues.

## promiseAdded

- Tag: `promiseAdded`
- Source: [src/types/semantic-change-kind.ts#L319](/src/types/semantic-change-kind.ts#L319)

promiseAdded — New promise construction/chain added.

## promiseRemoved

- Tag: `promiseRemoved`
- Source: [src/types/semantic-change-kind.ts#L324](/src/types/semantic-change-kind.ts#L324)

promiseRemoved — Promise usage removed.

## sideEffectImportAdded

- Tag: `sideEffectImportAdded`
- Source: [src/types/semantic-change-kind.ts#L249](/src/types/semantic-change-kind.ts#L249)

sideEffectImportAdded — A new import was added that may have side effects.

Modules that only have side effects can change the behavior of the application.

## spreadOperatorAdded

- Tag: `spreadOperatorAdded`
- Source: [src/types/semantic-change-kind.ts#L329](/src/types/semantic-change-kind.ts#L329)

spreadOperatorAdded — New spread syntax introduced.

Can affect copy vs reference behavior and property precedence.

## spreadOperatorRemoved

- Tag: `spreadOperatorRemoved`
- Source: [src/types/semantic-change-kind.ts#L336](/src/types/semantic-change-kind.ts#L336)

spreadOperatorRemoved — Spread usage removed.

## stateManagementChanged

- Tag: `stateManagementChanged`
- Source: [src/types/semantic-change-kind.ts#L341](/src/types/semantic-change-kind.ts#L341)

stateManagementChanged — State management usage changed.

Example: useState to useReducer, or store wiring changes.

## ternaryAdded

- Tag: `ternaryAdded`
- Source: [src/types/semantic-change-kind.ts#L348](/src/types/semantic-change-kind.ts#L348)

ternaryAdded — New ternary conditional introduced.

## ternaryRemoved

- Tag: `ternaryRemoved`
- Source: [src/types/semantic-change-kind.ts#L353](/src/types/semantic-change-kind.ts#L353)

ternaryRemoved — Ternary removed.

## throwAdded

- Tag: `throwAdded`
- Source: [src/types/semantic-change-kind.ts#L358](/src/types/semantic-change-kind.ts#L358)

throwAdded — New exception throwing added.

Changes error handling requirements for callers.

## throwRemoved

- Tag: `throwRemoved`
- Source: [src/types/semantic-change-kind.ts#L365](/src/types/semantic-change-kind.ts#L365)

throwRemoved — Removed explicit exception throwing.

May broaden successful paths but also hide failures.

## tryCatchAdded

- Tag: `tryCatchAdded`
- Source: [src/types/semantic-change-kind.ts#L372](/src/types/semantic-change-kind.ts#L372)

tryCatchAdded — New try/catch or finally block added.

Alters error propagation and side effects in failure cases.

## tryCatchModified

- Tag: `tryCatchModified`
- Source: [src/types/semantic-change-kind.ts#L379](/src/types/semantic-change-kind.ts#L379)

tryCatchModified — Existing error handling was changed.

Catch filters, rethrow behavior, or finally semantics differ now.

## typeDefinitionChanged

- Tag: `typeDefinitionChanged`
- Source: [src/types/semantic-change-kind.ts#L386](/src/types/semantic-change-kind.ts#L386)

typeDefinitionChanged — A type alias or composite type changed.

Includes union/intersection member changes, mapped and template
literal updates, or structural reshaping that affects assignability.

## variableAssignmentChanged

- Tag: `variableAssignmentChanged`
- Source: [src/types/semantic-change-kind.ts#L394](/src/types/semantic-change-kind.ts#L394)

variableAssignmentChanged — An assignment to a variable changed.

Suggests altered data flow or state transitions.

## variableDeclarationChanged

- Tag: `variableDeclarationChanged`
- Source: [src/types/semantic-change-kind.ts#L401](/src/types/semantic-change-kind.ts#L401)

variableDeclarationChanged — A variable's declaration changed.

Type changes, const vs let, or initializer differences can alter
runtime values and mutability.


---

Meta

- Total kinds: 57
- Generated on: 2025-09-29T01:25:41.430Z
- Generator: `src/tools/generate-semantic-change-kind-docs.ts`
