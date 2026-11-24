# Cephalon Abacus

A damage calculator for Warframe that simulates the game's maths and shows its working.

- **Right numbers, explained.** The maths is deterministic and unit-tested, and every result carries a trace that names each factor behind it.
- **Everything is a module.** Weapons, mods, arcanes, buffs and debuffs are data: lists of effects on named buckets. Unique mechanics go through hooks, never special cases in the engine.
- **The game changes, the code doesn't.** Damage types, buckets, factions, scaling curves and items live in versioned data files.
- **Verified against the game.** Worked examples from the wiki are unit tests, and in-game measurements become fixtures that run on every pull request.

Status: early. The engine is being built phase by phase, and there is no UI yet.

## Getting started

You need [pnpm](https://pnpm.io) 11. It downloads the right Node version itself.

```bash
pnpm install
pnpm build
pnpm test
pnpm dev      # the app
```

## Layout

| Path                 | What it holds                                                    |
| -------------------- | ---------------------------------------------------------------- |
| `packages/data`      | Schemas, the loader and the versioned game library               |
| `packages/engine`    | The pure damage engine                                           |
| `packages/importers` | Scripts that build the library from the wiki and other sources   |
| `packages/app`       | The React app, which runs the engine in a Web Worker             |
| `tests/golden`       | Fixtures recorded in the game                                    |
| `docs/BIBLE.md`      | The research and engine spec: every formula, and how sure we are |
| `CLAUDE.md`          | Architecture and conventions                                     |

Cephalon Abacus is a fan project. It is not affiliated with Digital Extremes.
