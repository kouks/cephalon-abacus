# Cephalon Abacus

A damage calculator for Warframe that simulates the game's maths. Builds are put together from modules (mods, arcanes, ability buffs, shards, enemy debuffs), weapons are presets of base stats, and every number traces back to the factors that made it. One TypeScript monorepo: a pure, deterministic engine, a versioned data library with its importers, and a React app that runs the engine in a Web Worker.

This file describes the architecture and the conventions. When a convention changes, update this file in the same commit.

## Product pillars

1. **Right numbers, shown working.** All maths is deterministic, unit-tested code in `packages/engine`. Every result carries a trace that names every factor; a number the trace can't explain is a bug.
2. **Everything is a module.** A weapon is data; a mod is a list of effects on named buckets. The engine never branches on a weapon or mod id: what effects can't express goes through a registered hook.
3. **The game changes, the code doesn't.** Damage types, buckets, factions, scaling curves and every item live in versioned data files. A balance patch is a data change.
4. **Verified against the game.** Wiki examples become unit tests; in-game measurements become golden fixtures that run on every pull request. A rule nobody has confirmed sits behind a named assumption until a test settles it.
5. **Small, readable code.** Lint and an architecture test enforce small files, small functions and strict boundaries.
6. **Accessible.** Interactive parts of the app are built on React Aria. Text contrast is tested.

## Sources of truth

- **Mechanics, formulas and architecture:** the BIBLE, our R&D spec, is a Claude Doc: [Cephalon Abacus — Research & Engine Spec](https://claude.ai/artifact/9uUVRXTC8cFiNbKHx8oJhs). It changes as we learn, so it lives only there: read and edit it with the Claude Docs tools, and don't copy it into the repo. Cite it in code comments, tests and tickets as `BIBLE §8`; keep its section numbers stable. It tags every rule: **[W]** wiki, consistent; **[W?]** wiki, incomplete or self-contradictory; **[C]** community, unverified; **[T]** needs an in-game test. When the code learns something the BIBLE doesn't say, or proves it wrong, update it as part of the same ticket and say so in the pull request.
- **Work:** Linear, team **ABA** (`linear.app/kx-abacus`). One project per phase: Abacus 1: Core engine, Abacus 2: Status and enemies, Abacus 3: Melee and buffs, Abacus 4: Breadth and hooks. Each project has acceptance criteria and ends in a gate ticket of in-game tests. Each ticket has Goal, Steps, Done when and Spec.
- **Game data:** wiki.warframe.com, the official wiki since 2025. **Never the Fandom wiki:** it is a stale fork. Then WFCD's `@wfcd/items`, DE's Public Export, and warframe.com patch notes for every hotfix.
- **Ground truth:** Pavel's in-game tests (see In-game tests). But the wiki is right most of the time, so a test that disagrees with it doesn't win by itself: push back first. Only what Pavel then confirms, with every condition and result stated back, overrules the wiki, and the BIBLE records why.
- **Game version:** the library targets one version at a time, currently Update 44, Hotfix 44.1.4.1. Every item records the version it was checked against.

## Commands

Keep the list in step with `package.json`.

```bash
pnpm install              # pnpm runs scripts on Node 24 (devEngines.runtime); `nvm use` for a bare shell
pnpm dev                  # the app (Vite), with the engine in a Web Worker
pnpm build                # every package, then the app into packages/app/dist
pnpm lint                 # ESLint, zero warnings allowed
pnpm format               # Prettier write  (format:check in CI)
pnpm typecheck            # tsc -b across the workspace, tools last
pnpm test                 # Vitest: unit and property tests in every package, plus tools
pnpm test:coverage        # …with coverage; fails if packages/engine drops below 90% (what CI runs)
pnpm test:golden          # the in-game fixtures in tests/golden, through the public engine API
pnpm test:e2e             # Playwright against the built app (once the app has screens)
pnpm data:validate        # load the whole library; fails on any error or a missing source or gameVersion
pnpm data:update --game-version <v>   # run the importers, apply overrides, validate, write the changelog (from ABA-47)
pnpm bench                # how long phase A takes for a full build (the limit is 1 ms)
pnpm deps:audit           # known vulnerabilities in the dependencies (fails on high or critical)
pnpm commit:check <file>  # Conventional Commits and Linear ID check (`--text "…"` for a string)
pnpm branch:check         # the current branch name against the Linear pattern
```

Before you call any change done, run `pnpm lint && pnpm typecheck && pnpm test`. If it touches the engine or the library, also `pnpm test:golden && pnpm data:validate`.

## Toolchain and version pins

| Tool       | Version                                                                     | Notes                                                                         |
| ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Node       | 24 LTS                                                                      | Pinned in `package.json#devEngines.runtime`; `.nvmrc` matches.                |
| pnpm       | 11                                                                          | `pnpm-workspace.yaml` blocks new releases for 24 h and all install scripts.   |
| TypeScript | **`~6.0` (pinned)**                                                         | `latest` is 7.x, but typescript-eslint supports `<6.1`. Don't bump the major. |
| Validation | zod                                                                         | Every library file and every `Scenario`.                                      |
| Build      | Vite 8 (app), `tsc -b` (packages)                                           |                                                                               |
| React      | 19.3                                                                        | No React Compiler; see The app.                                               |
| UI library | React Aria Components 1.22                                                  | Accessible behaviour for every interactive part.                              |
| Styling    | vanilla-extract                                                             | `css`, `recipes`, `dynamic`                                                   |
| Workshop   | Storybook 10                                                                | Once the design system exists.                                                |
| Lint       | ESLint 10 flat config, typescript-eslint, import-x, check-file, react-hooks |                                                                               |
| Tests      | Vitest 5, fast-check, Playwright 1                                          | Unit, property, golden fixtures; e2e once the app has screens.                |
| Hosting    | not decided                                                                 | The app is static. Record the choice here.                                    |

## Directory map

```
packages/
  data/
    src/schema/     zod schemas, one file per type, and the types inferred from them
    src/load/       the loader: validates library files, collects every error
    src/testing/    made-up items for tests
    src/assert.ts   the shared assert module
    library/        damageTypes.json, buckets.json, factions.json, scaling.json,
                    weapons/, mods/, arcanes/, buffs/, enemies/, stances/
    CHANGELOG/      one file per game version, written by data:update
  engine/
    src/build/      effects, buckets, modded stats, element combiner, damage composition
    src/enemy/      an enemy's stats at its level
    src/resolve/    rollers, crits, the hit resolver, health layers, extra hits
    src/metrics/    per shot, DPS and lifetime damage, in closed form
    src/timeline/   event queue, enemy state, statuses and DoTs, weapon cycle, combo
    src/hooks/      the hook registry and every hook
    src/trace/      trace records
    src/assumptions.ts   every open [T] rule as a named flag
    src/testing/    libraries and scenarios for tests, with real items
    src/api.ts      evaluate() and simulate(): the only public entry
  importers/        wiki Lua, WFCD and enemy importers; overrides/ holds hand corrections
  app/              Vite + React; src/engine/ is the Worker and its bridge, src/format/ the
                    formatting module, src/debug/ what the debug page is made of, src/theme/ the theme
tests/golden/       in-game fixtures, one file per test, and their runner
tools/              architecture test, ESLint config test, git checks, library checks
eslint/             ESLint config modules, composed by eslint.config.ts
docs/data-updates.md   refreshing the library for a new game version
.github/            workflows, Dependabot, the shared setup action
```

### Layering

A package may import from itself or from packages to its left. The `architecture/layers` lint rule enforces this.

```
data  →  engine  →  app
data  →  importers
```

- **The engine is pure:** no React, DOM, Node APIs, `Date`, `performance` or `Math.random`. Randomness comes only from a `Roller`; time is simulated time, passed in.
- **The app runs the engine only inside `app/src/engine/`** (the Worker and its bridge). Everywhere else it imports engine types only (`import type`).
- **Importers never import the engine.** Their job is data; the loader validates it.
- **`tests/golden` calls only `evaluate` and `simulate`** from `engine/src/api.ts`, exactly as the app does. `API_VERSION` goes up when a `Scenario` or a `Result` changes in a way that breaks its readers.
- **Imports:** `@abacus/<package>` across packages. Inside a package, `@/…` for anything outside the current folder; relative paths for siblings and at most one level up (`../`). `../../` is banned.
- **Packages are consumed from source.** `package.json#exports` points at `src`, `tsc -b` emits declarations only, and Vite and Vitest resolve `@/…` from the importing file's own package (`resolve.tsconfigPaths`).
- **`tools/` and `eslint/` run on Node directly** (type stripping, no build), so they import with the `.ts` extension, and reach each other and the packages through `package.json#imports` (`#eslint/…`, `#data/…`). A script that imports a package runs through `node tools/run.ts <script>`, which resolves `@/…` as Vite does.

## The engine

- **Two phases** (BIBLE §3). Build (`buildAttack`) turns a `Scenario` into per-attack stats once per change; Resolve (`resolveHit`) turns one hit into damage on one enemy; the timeline drives Resolve over time. Build never reads enemy state; Resolve never reads modules.
- **Buckets are data.** Every effect names a bucket from `buckets.json` and one op: `STACKING_MULTIPLY`, `MULTIPLY`, `ADD` or `OVERRIDE` (BIBLE §5). A new kind of bonus is a new bucket entry, a test, and a line in BIBLE §5.
- **No id checks.** The engine never compares against a weapon, mod or enemy id (`if (weapon.id === 'kohm')`). Unique mechanics are hooks, registered by id in `engine/src/hooks/` (BIBLE §14), and only for what effects can't express. The architecture test fails on an id literal outside `hooks/`.
- **Hooks are pure.** They get a read-only context and return changes. They never mutate state, and each writes a trace entry.
- **A hit meets one layer:** the scenario's `enemy.layer`, or the first the enemy has left (`enemy.left`, all of each layer when absent). Each type's `layer` factor comes from `damageTypes.json`, armor reduces health alone, and each type it reduces deals at least 1 (the `least` factor), so a type's damage stays the product of its factors (BIBLE §10).
- **Every factor is traced.** A multiplier that changes a number appears in the `HitTrace` under a stable name, with the effects that made it. A type's damage is the product of its factors, so a new multiplier is a new factor, even while its value is 1. Tests assert on the trace, not just the total.
- **Unknowns are named assumptions.** Each [T] rule is a flag in `assumptions.ts` that names its test and BIBLE section (`bowFireRateDoubled: { default: true, test: 'T-10', bible: '§9' }`), and code takes the flags as an `Assumptions` argument. Never settle one quietly in code. When a test answers it: set the default, add the fixture, update the BIBLE.
- **Precision.** Keep full precision through the pipeline. Quantize only where the BIBLE says: each type's ratio, to 1/32 of base damage (§6), and the base crit multiplier, to 32/4095 (§7). Round only for display. Proc DoTs are never quantized. Enemy stats are worked out in 32 bits, step by step, as the wiki says (§10): `f32` in `enemy/growth.ts`.
- **Units.** Percentages are fractions (+165% is `1.65`), times are seconds, distances are metres. Field names follow the BIBLE (`critChance`, `critMultiplier`, `fireRate`, `chargeTime`).
- **One code path, two modes.** Expected value and Monte Carlo differ only in the `Roller`. What works in one mode works in both; the convergence property test guards it.
- **Conditionals are switches.** A conditional is the effects of one module (or the weapon) on one trigger. What an effect `requires` as well (Galvanized Scope: `whileAiming`) is a switch of its own. The scenario has a global on/off and overrides per conditional. A switch sets the stacks it starts with: on is all of them, off is none. In a simulation they expire as in the game. `collectEffects` never bakes stacks in, so a simulation can change them without reading modules again.
- **Layers in order.** `applyHit` takes one hit through Overguard, shields and health as they are left, skipping a layer that is gone. What is left of a hit that breaks Overguard goes on in full; past shields, 5% of it does, and all of it on a weak point (BIBLE §10). Types that skip a layer (Toxin, shields) go on as they are. Each part's hit carries `dealt`: per crit tier, what each layer shows and loses, and what is left after.
- **Shown and applied.** Where the game's number differs from what the enemy loses (the hit that breaks a part, the hit that breaks shields, the hit that kills), a hit carries both, and the app shows the game's first: "1,958 (1,079 applied)". A number players can't find in the game is one they won't trust (BIBLE §15). A shield a hit breaks shows the hit less what of it went on (T-38: 586 and 14 from 600 on 323 shields), as the shield took it until T-47 says (`breakShownInOwnTerms`). Overguard shows one number for all a hit does (see Gotchas).
- **A build that doesn't work as written returns warnings**, as codes with data, and a usable result. So does a result that leaves out something the weapon does (`leftOut`). It throws only when there is nothing to evaluate.
- **Pellets resolve one at a time** against the shared enemy state, so later pellets see earlier procs (BIBLE §5). Direct hits and their AoE share that state too.

## The data library

- Every file uses the envelope `{ schemaVersion, gameVersion, source, items[] }`, and every item carries `source` (a URL) and `gameVersion`. `data:validate` fails without them.
- `id` is a stable lower-kebab slug; store DE's `uniqueName` beside it when known. Never change an id: fixtures and saved builds point at it.
- Percentages are fractions. Per-rank values follow the linear rule or an explicit array of shares of the max-rank value.
- **Schemas refuse unknown keys** and fill in no defaults, so a misspelt field is an error and the data says what it means. Checks inside one item live in its schema, so items players write get them too; checks across items live in the loader.
- **The loader reads no files:** it takes their text and returns a library or every error, so it runs in the browser, in tests and in `data:validate` alike.
- **Reference files** (`damageTypes.json`, `buckets.json`, `factions.json`, `scaling.json`) are needed by every library and written by hand. The 20 damage type ids are a fixed list in `schema/damageType.ts`; their rules are data. `tools/data/library.test.ts` snapshots the first three and `scaling.test.ts` checks spot values of the last, so a balance patch shows up as a diff.
- **Buckets:** a bucket with `members` is a family (`damage.faction.<group>`); look names up with `findBucket`. Its `scope` says how many times it applies to direct hits, procs, extra hits and AoE, and its `bodyPart` that it needs a weak point or a head.
- **Damage types list the layers they hit**, with a multiplier for each. A layer that is absent is skipped: Toxin has no `shield`.
- **Enemies:** an Eximus is an enemy of its own, with its own id. Body parts follow the wiki's Enemy Body Parts table (its marks say what isn't a headshot or has no headcrit), and where its enemy data disagrees, the table wins until a test decides.
- **Importers never guess.** A field or phrase with no mapping rule is logged and goes to `importers/overrides/*.json` for a person to write. Overrides apply last and are reviewed like code.
- Generated library files are committed, and only `data:update` writes them. To correct one, edit its override, never the generated file.
- An update for a new game version writes `CHANGELOG/<version>.md`. A change that touches a golden fixture names it, so its test gets requested again.

## In-game tests

- Pavel runs tests in the game on request. Ask in batches of 3–4, and only once the engine has the code a test exercises, so each report can be replayed at once.
- Use the request template in BIBLE §16: Simulacrum, enemy and level, weapon and rank, every mod and its rank, no arcanes, companion or abilities unless they are the variable, body or head, and what to report. Change one variable per test.
- Each report becomes `tests/golden/T-<n>-<topic>.json` (`T-5-cold-crit.json`) with the report word for word (typos fixed), the observed values exactly as reported, the game version, and a tolerance (`schema/goldenFixture.ts`). Each case holds a whole `Scenario`, which the debug page takes as it is. A fixture brings the modules, weapons and enemies that the library lacks, such as a Riven, and `hitsOf` names the attack whose numbers were read if it isn't the shot itself: an explosion. Never edit an observed value to make a test pass.
- **Health, shields and Overguard have no number:** ask for the hits by colour until each is gone (`depleted`). Shields are exact to 10 with one hit that breaks all of them (BIBLE §10): that hit's numbers go in `layered`, with the hits before it. The runner replays hits one at a time through `evaluate`, with what the enemy has left in `enemy.left`.
- **When a report differs from the wiki, push back.** Quote what the wiki says, repeat the conditions as you understood them (enemy and body part, weapon, firing mode, every mod and its rank, aiming, what was read off), and ask for the conditions and results to be stated back. Until they are, the wiki's rule stands, the fixture waits, and nothing is written down as wrong. Look for the mundane reason first: another enemy, another variant of the weapon, a Riven, a buff.
- Ask for the numbers that were seen, not whether predictions match, when the wiki says something else.
- **Distances in the Simulacrum:** the lines of the floor are 4 m apart, and Follie's barrel on a crossing is a neutral target that stays put. Readings of a waypoint are a metre coarse.
- Gates: Gate 1 is T-1 to T-4, T-14, T-17 to T-35 and T-41, all answered; Gate 2 is T-5 to T-10, T-13, T-36 to T-40 and T-44 to T-47; Gate 3 is T-11, T-12, T-15 and T-16; Gate 4 is the sample builds.

## The app

UI and UX design are the next phase. Until then the app is an unstyled debug page: pick a weapon and mods or edit the scenario, and read the result and its trace. These rules apply from the first component.

- **The app never computes damage.** It sends a `Scenario` to the Worker (`createEngine().evaluate`) and draws what comes back, trace included. The Worker checks the scenario, and a newer scenario replaces one that still waits. Display helpers are pure functions outside components.
- **Components:** each in its own PascalCase folder, holding only:

  ```
  Foo/
    Foo.tsx            view only: calls useFoo() once, renders JSX
    Foo.hooks.ts       exports exactly one hook: useFoo()   (only if Foo has logic)
    Foo.css.ts         vanilla-extract styles
    Foo.test.tsx       component tests (if needed)
    Foo.stories.tsx    Storybook stories
  ```

  - `Foo.tsx` exports `Foo` (and optionally `type FooProps`) and nothing else, and calls no hook but `useFoo()`.
  - All logic goes in `useFoo()`: state, effects, handlers, derived values. It returns a view-model object with named fields, not a tuple.
  - Arrow functions with named exports. **No `index.*` files, no barrels, no default exports** (except config files and story `meta`).
  - Event props are `onX`; handlers are `handleX`. Booleans start with `is`, `has` or `can`.

- **Hooks orchestrate; they don't compute.** No React Compiler: don't add `useMemo`, `useCallback` or `memo` for performance; use them only for a stable identity, with a comment saying why.
- **React Aria** for anything with behaviour; style its states with its data attributes (`[data-pressed]`, `[data-focus-visible]`, `[data-hovered]`, `[data-disabled]`). Never pass `isInvalid={false}`.
- **Styling:** values only from the theme contract; raw colours (`#hex`, `rgb()`, `hsl()`) are banned outside the theme (lint). The design system's rules get their own section here when it exists.
- **Accessibility (non-negotiable):** everything keyboard-operable with a visible focus ring; touch targets at least 44px on phones; colour never the only signal; a control can't be disabled without saying why; text contrast tested.

## Numbers and copy

- Show damage as the game does: whole numbers with comma thousands (`12,345`), percentages to one decimal (`28.5%`), multipliers with an x (`2.2x`). Every displayed number goes through one formatting module.
- Every relative number names its baseline ("+18% vs no Roar").
- Sentence case, no exclamation marks. Buttons start with a verb and say exactly what happens.
- Write invisible characters as escapes (`\u00a0`); `no-irregular-whitespace` is strict.

## TypeScript

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noImplicitOverride`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, no unused locals or parameters.
- **Banned:** `any`, `enum` (use `as const` objects and unions), non-null `!` (use `must()` / `invariant()` from `@abacus/data/assert`), object-literal type assertions.
- Use `type`, not `interface` (BIBLE §15 sketches with `interface`; write them as `type`). Use `import type` for type-only imports. Exhaustive `switch`es end in `assertNever(x)`.
- Prefer `readonly` arrays and fields for data that crosses module boundaries. Library types are deeply `readonly`.
- `exactOptionalPropertyTypes` clashes with some library props. Pass the type the library wants; don't cast.

## Size and complexity limits

These are lint **errors**. Don't use `eslint-disable` to get around them.

| Rule                  | Limit                                |
| --------------------- | ------------------------------------ |
| Lines per file        | 150 (300 for tests, 200 for stories) |
| Lines per function    | 40 (no limit in tests)               |
| Cyclomatic complexity | 8                                    |
| Nesting depth         | 3                                    |
| Parameters            | 3; use an options object beyond that |
| Nested callbacks      | 3                                    |

Split long files by concern, extract helpers, and use early returns and lookup tables. A formula with many terms is a lookup of named factors, not one long expression. JSON library files are exempt; their schemas are not.

## Lint and the architecture test

- **ESLint** config is split across `eslint/` modules, composed in `eslint.config.ts`:
  - `base`: typescript-eslint strict and stylistic (type-checked), react-hooks, import-x (`no-default-export`, `no-cycle`), `func-style: expression`, strict `no-irregular-whitespace`.
  - `limits`, `naming` (check-file: no `index` files, PascalCase `.tsx`, hooks and stories only in component folders), `boundaries` (`architecture/layers`, the app's engine imports), `purity` (engine and data: framework-free imports, determinism bans), `syntax` (shared option lists), `files` (shared globs), `rules/` (our own rules).
- **Gotcha:** if two config blocks set `no-restricted-syntax` (or `@typescript-eslint/no-restricted-imports`) on the same file, the later one replaces the earlier. Every block that sets one must spread `BASE_SYNTAX` / `BASE_RESTRICTED_IMPORTS` from `eslint/syntax.ts`.
- **`tools/eslint/eslintConfig*.test.ts`** lint virtual files against the real config: every banned pattern must error and well-formed code must pass. When you add a rule, add a case.
- **The architecture test** (`tools/architecture/`) enforces what lint can't: the layers in each `package.json` and `tsconfig.json`, component folder contents, `X.tsx` exporting only `X`/`XProps` and calling only `useX`, no id literals in the engine outside `hooks/` (tests and `testing/` aside), and every flag in `assumptions.ts` citing a test (`T-5`) and a BIBLE section (`§7`).

## Testing

- **Vitest**, one project per package plus `tools`. Pure logic gets thorough unit tests. Coverage of `packages/engine` must stay at or above 90%.
- **Every worked example in the BIBLE is a unit test**, named after it (`gram crit chance at 7x combo is 69%`).
- **Property tests** (fast-check): the Monte Carlo mean converges to the expected value; damage is never negative; a module with only positive effects never lowers expected damage, except documented traps (Acuity locks multishot; an element can re-pair the others).
- **Golden fixtures** run through the public API on every pull request (see In-game tests). A mismatch prints the hit's factors, and what each would have to be to explain the reported number on its own. What a fixture covers needs no test elsewhere.
- **A test must be able to fail.** Change the constant it checks and watch it go red before trusting it.
- **Playwright** with axe, once the app has screens.

## Linear, branches and pull requests

- **One ticket, one pull request.** Before starting, read the ticket, its blockers and its project's acceptance criteria. If the work outgrows one PR, split the ticket in Linear first (sub-issues) and branch from the sub-issue. Work with no ticket gets one first, in the right project, with the same template (Goal, Steps, Done when, Spec).
- **Branch names:** `<type>/aba-<n>-<short-topic>`, lower case, words joined by hyphens: `feat/aba-14-quantization`, `fix/aba-22-armor-cap`. The ID links the branch and its PR to the ticket. Linear's "Copy git branch name" (Cmd/Ctrl+Shift+.) follows the workspace's branch format (Settings → Features → Integrations → GitHub → Branch format) and gives `koukskoch/aba-14-…` by default; swap the username for the type before pushing.
- **Commits:** Conventional Commits with the ticket as scope: `type(ABA-n)!: summary`, imperative, lower-case summary, header at most 72 characters. Types: `feat`, `fix`, `perf`, `refactor`, `style`, `test`, `docs`, `build`, `ci`, `chore`, `revert`. `!` marks a breaking change. The commit-msg hook fills in `(ABA-n)` from the branch name when the scope is missing, and refuses a scope that names another ticket.
- **Pull request titles** follow the same format: `feat(ABA-14): quantize damage types to 1/32 of base damage`. Pull requests are squash-merged, so the title becomes the commit on `main`. The body ends with `Closes ABA-n`. The "Pull request title" workflow checks the format and that the ID matches the branch's.
- The patterns `tools/git/` checks:

  ```
  branch  ^(feat|fix|perf|refactor|style|test|docs|build|ci|chore|revert)/aba-[1-9][0-9]*-[a-z0-9]+(-[a-z0-9]+)*$
  header  ^(feat|fix|perf|refactor|style|test|docs|build|ci|chore|revert)\(ABA-[1-9][0-9]*\)!?: [a-z].*$   (≤ 72 characters)
  ```

- **Ticket status:** once Linear's GitHub integration is connected, a linked ticket moves to In Progress when its PR opens and to Done when it merges (Settings → Team → Workflows & automations changes this). Until then, set the status in Linear by hand.
- **Stacked pull requests** follow Linear's "blocked by": branch from the blocker's branch, open the PR against it, and retarget it to `main` once the first is merged.
- **Exempt from the ID rules:** Dependabot's branches and its `chore(deps)` pull requests. Nothing else.
- **Don't commit to `main` directly.** lefthook: pre-commit runs Prettier and ESLint on staged files; commit-msg checks (and fills in) the message; pre-push checks the branch name, then runs typecheck and tests. Don't bypass hooks with `--no-verify`.

## CI (GitHub Actions)

- `.github/workflows/ci.yml`, on every pull request and push to `main`: `checks` (format, lint, typecheck, unit tests with coverage, golden fixtures, `data:validate`, build, and `pnpm bench`, which can't fail it) and, once the app has screens, `e2e`. A failed e2e run uploads the Playwright report.
- `.github/workflows/pull-request-title.yml` checks the title and its ticket ID against the branch.
- `.github/workflows/audit.yml`: `pnpm deps:audit` on pull requests, pushes to `main` and weekly. Fails on high or critical.
- **Dependabot** (`.github/dependabot.yml`): npm, weekly, minor and patch only, grouped into one pull request, and only for releases a week old. Majors are done by hand (TypeScript stays `~6.0`).
- `.github/actions/setup` is the shared setup: pnpm (from `packageManager`), Node from `.nvmrc`, `pnpm install --frozen-lockfile`.
- Action versions are pinned to major tags; bump them together.

## Gotchas

- **TS 7:** `pnpm add -D typescript` installs 7.x. Keep the `~6.0` pin until typescript-eslint supports it.
- **The Fandom wiki is stale.** It froze at Hotfix 38.5.1, and some pages are far older. Old sources also describe Damage 2.0 health classes (Ferrite, Alloy, Flesh), gone since Update 36.0: ignore them.
- **wiki.warframe.com sometimes refuses automated fetches** of large pages. A revision URL (`?oldid=…`) or the page's `Module:*/data` source usually works.
- **Rivens have no disposition** since Hotfix 44.1.3: every riven rolls as if it were 1.2. Ammo Efficiency caps at 75%.
- **Quantize the ratio, not the amount** (BIBLE §6). The wiki contradicts itself on whether +Damage applies before or after; on a ratio both readings agree.
- **Quantization can punish a bonus:** a sliver of Toxin in front of 51% Heat and 51% Cold re-pairs the elements, and 33/32 of Blast becomes 16/32 of Gas and 16/32 of Cold.
- **Falloff ends before its second number:** the line heads for no damage there, and stops at the weapon's least. Of 10 to 20 m, Hek (20%) is at its least from 18 m on and Tigris Prime (51.28%) from 14.9 m (T-25, T-26). The wiki draws the line to the least at the end.
- **An explosion falls off as a power:** (1 − distance ÷ radius)^falloff, nothing at the radius, and even all over without falloff (T-28 to T-35, T-41). The wiki draws a line to the edge damage: Carmine Penta deals 77 of 350 near its rim where that says 175. The distance is to the enemy's body, about half a metre nearer than its feet.
- **A hit that breaks a part shows more than it deals:** the number is 2 × the hit − what the part had left, and the enemy loses the hit alone (T-43). A Scaldra backpack has 200, a Culverin canister more with every level. Both numbers belong in the result (see Shown and applied).
- **An Overguard break shows one number:** what the Overguard had left plus what the layers after it took, armor included, rounded once (T-44: 130.1 + 354.8 shows 485). Those layers show none of their own, so their `shown` is absent. Shields that break show two numbers (T-38).
- **Shields are whole numbers,** rounded to the nearest once grown: the wiki's 2,384.4 at level 50 is 2,384 in the game (T-46). That is data, the `whole` rule in `scaling.json`; health and Overguard keep their fractions.
- **Faction bonuses double-dip** in proc DoTs and extra hits, and triple-dip in an extra hit's DoT. That is the game, not a bug.
- **Heat merges** into one instance per enemy that keeps the first proc's bonuses, so an unmodded first proc drags the whole stack down.
- **Arsenal percentages are relative to the base stat:** +150% crit chance on a 20% weapon is 50%. Flat sources (Arcane Avenger, Puncture stacks) add points afterwards.
- **A 2x crit multiplier is 2.0005x:** the game quantizes the base, before mods. And a headcrit isn't always 2x: the multiplier belongs to the body part (Juggernaut's maw has 4x).
- **A mod's displayed maximum can be rounded.** The game keeps a rank-0 value: Acuity's 350% is 11 × 31.8% = 349.8%. Check new mods against DE's number at every rank.
- **GunCO isn't always additive.** Galvanized mods multiply with Serration on some weapons; that is the per-weapon `gunCOMode`, never a special case in code.
