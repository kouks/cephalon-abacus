# Cephalon Abacus — Research & Engine Spec

Nov 24, 2026 · @Pavel

## 0. Purpose and how to use this doc

This is the research handoff for **Cephalon Abacus**, a damage calculator for Warframe. It lists every variable the engine must account for, the formulas as currently documented, and a proposed modular architecture. The game version it targets is **Update 44 (Iceblade of Narin), Hotfix 44.1.4.1, 2026-10-28**. No UI/UX design is included; that is the next phase.

Design goals taken from the brief:

- **Everything is a module.** A weapon is a preset of base stats. Mods, arcanes, ability buffs, shards, companion buffs and enemy debuffs are all _effects_ that write into named stat buckets. A superuser can build a custom weapon and custom mods and still get a correct calculation.
- **Escape hatches, not special cases.** Unique weapon perks and Incarnon evolutions are too specific to express as plain stat effects. They get a scripted hook API (section 14) instead of hard-coded branches in the engine.
- **Extensible as the game changes.** Bucket names, stacking rules, damage types, factions and status effects live in data files, not code.
- **In-game verification.** The user has offered to run in-game tests. Section 16 defines the protocol and a starter test list.

How an implementing agent should read it:

1. Sections 3 and 5 are the core: the pipeline order and the bucket stacking rules. Build the engine around these.
2. Sections 6 to 13 are the per-mechanic reference. Each formula is tagged with a confidence level.
3. Section 15 is the architecture sketch; section 17 is the phased roadmap.

Confidence tags used throughout:

| Tag        | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| **\[W\]**  | Stated on wiki.warframe.com and consistent with other sources                 |
| **\[W?\]** | Stated on the wiki, but the wiki flags it as incomplete or self-contradictory |
| **\[C\]**  | Community knowledge or older docs; plausible but not re-verified for U44      |
| **\[T\]**  | Needs an in-game test before we rely on it (see section 16)                   |

## 1. Sources of truth

Use **wiki.warframe.com**, not Fandom. The community wiki forked off Fandom to wiki.warframe.com with DE's support ([2025 Year in Review](https://wiki.warframe.com/year-in-review-2025/)). The Fandom copy is stale: its main page still shows Hotfix 38.5.1 (2025-03-19), while the official wiki tracks Hotfix 44.1.4.1 (2026-10-28) ([Fandom main page](https://warframe.fandom.com/wiki/WARFRAME_Wiki), [official main page](https://wiki.warframe.com/?oldid=2812052)). Some Fandom pages are much older still (its Status Effect page reflects Update 27.5).

| Source                                                                                                                | Use it for                                                      | Notes                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [wiki.warframe.com Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation)                                | Quantization, DM formula, DPS formulas                          | Flagged by the wiki as incomplete and self-contradictory on quantization order **\[W?\]**                                                                       |
| wiki.warframe.com mechanic pages (Armor, Enemy Level Scaling, Blast, Tau, faction pages)                              | Per-mechanic formulas                                           | Best available; cite per section                                                                                                                                |
| [Module:Weapons/data/\*](https://wiki.warframe.com/w/Module:Weapons/data/primary?oldid=2812366) (Lua tables)          | Weapon presets with **per-attack** data (alt fire, AoE, charge) | Last updated 2026-09-23; schema maps to Public Export keys. Best seed for the weapon library                                                                    |
| DE Public Export (`origin.warframe.com/PublicExport/index_<lang>.txt.lzma` then `content.warframe.com/PublicExport/`) | Canonical base stats, unique names                              | LZMA index then JSON ([description](https://gamecytus.netlify.app/host-https-warframe.fandom.com/wiki/Mobile_Export)). Mostly the primary attack only **\[C\]** |
| [warframe-public-export-plus](https://libraries.io/npm/warframe-public-export-plus)                                   | Fills Public Export gaps                                        | npm package; JSON split from localisation                                                                                                                       |
| [WFCD warframe-items](https://www.npmjs.com/package/@wfcd/items) (`@wfcd/items`)                                      | Mods, arcanes, warframes, enemies, images                       | Pre-parsed from Public Export; MIT; includes an Enemy category                                                                                                  |
| [warframe.com patch notes](https://www.warframe.com/en/patch-notes/pc/44-0-0)                                         | Change log per hotfix                                           | Read every hotfix for balance changes                                                                                                                           |
| In-game tests by the user                                                                                             | Ground truth                                                    | See section 16                                                                                                                                                  |

Recent changes an implementer must know (all after the Fandom freeze):

- **Damage 3.0, Update 36.0 (2024-06-18).** Health classes (Ferrite, Alloy, Flesh, etc.) were replaced by per-faction ×1.5 / ×0.5 modifiers ([Elements](https://wiki.warframe.com/w/Elements)). Steel Path stopped scaling armor ([Steel Path](https://wiki.warframe.com/w/The_Steel_Path)).
- **Tau damage, Update 37.0 (2024-10-02).** New neutral type whose proc raises status chance taken ([Tau Damage](https://wiki.warframe.com/w/Damage/Tau_Damage)).
- **Riven Splicer and stat locking, Update 44.1.** Rivens can now carry a _spliced trait_ (two stats fused into one) ([U44 wiki](https://wiki.warframe.com/w/Update_44:_Iceblade_of_Narin?oldid=2822043)).
- **Hotfix 44.1.3 (2026-10-22).** Riven dispositions removed; every riven now rolls as if disposition were 1.2. Ammo Efficiency capped at 75% ([summary](https://patched.gg/games/warframe/iceblade-of-narin-the-icebind-hotfix-4413), [patch notes](https://www.warframe.com/patch-notes/pc/44-1-3)).

### Reference calculator review: warframe-damage.com

What it does ([site](https://warframe-damage.com/)): a Monte Carlo "random queue" simulator. DPS = total random damage over a 20 s window ÷ 20. It models melee stance and decaying combo, riven input, Hunter Munitions and Internal Bleeding, a status timeline, and toggles such as Xata's Whisper and sniper scope.

Where it falls short, and what we do differently:

- **Simplifications.** Heat is treated as stripping 50% armor instantly; enemies with unique damage reduction are treated as normal. We model Heat's 2 s ramp and give enemies a DR hook.
- **Hidden factors.** It says not all factors are shown. We expose a full per-bucket breakdown for every number.
- **Separate attacks.** Direct hit and explosion don't share status. We use one shared enemy state per simulation.
- **No version pinning.** We stamp every data file with a game version.
- **Random only.** It has no deterministic "expected value" mode. We offer both (section 15).

## 2. Glossary

The engine's vocabulary. Use these exact names in code and data files.

| Term                                 | Meaning                                                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Attack**                           | One firing mode of a weapon (normal fire, alt fire, charged shot, AoE explosion, heavy attack, slam). A weapon has 1..n attacks; each has its own base stats.                |
| **Base damage**                      | The attack's listed damage per type before mods, e.g. 30 Impact / 30 Puncture / 40 Slash. _Total base damage_ is their sum.                                                  |
| **IPS**                              | Impact, Puncture, Slash: the physical types. IPS mods scale only types the weapon already has.                                                                               |
| **Modded base damage**               | Total base damage × (1 + base-damage bucket). The value most proc and quantization formulas key off.                                                                         |
| **Damage instance / hit**            | One packet of typed damage landing on one enemy: one pellet, one beam tick, one melee strike, one AoE application.                                                           |
| **Multishot**                        | Projectiles per trigger pull. The integer part is guaranteed; the fraction is the chance of one extra.                                                                       |
| **Bucket**                           | A named stat slot that effects write into. Values inside a bucket add; different buckets multiply. See section 5.                                                            |
| **Effect**                           | One stat contribution from any source: `{bucket, op, value, conditions}`. Mods, arcanes, buffs and debuffs are lists of effects.                                             |
| **Module**                           | A library item that bundles effects: a mod, an arcane, an ability buff, a shard, an enemy debuff, or a weapon preset.                                                        |
| **Quantization**                     | Rounding each damage type to the nearest 1/32 of modded base damage before further multipliers.                                                                              |
| **Proc**                             | A status effect application. Chosen by weighted roll over the hit's damage types.                                                                                            |
| **Forced proc**                      | A proc applied regardless of status chance (stance hits, abilities, Hunter Munitions).                                                                                       |
| **DoT**                              | Damage over time from Slash, Heat, Toxin, Electricity, Gas procs, plus Blast's delayed detonation.                                                                           |
| **Faction**                          | The enemy's damage-modifier profile (Grineer, Kuva Grineer, Corpus, Corpus Amalgam, Infested, Infested Deimos, Orokin, Sentient, Narmer, Murmur, Scaldra, Techrot, Zariman). |
| **Faction damage bonus**             | Bane mods and Roar. Multiplies the hit; applies twice to proc DoTs ("double dip").                                                                                           |
| **Crit tier**                        | floor(CC) guaranteed tiers, plus one more with probability frac(CC). Yellow = 1, orange = 2, red = 3+.                                                                       |
| **Weak point / headshot / headcrit** | Three distinct body-part flags; see section 11.                                                                                                                              |
| **Extra hit**                        | A separate damage instance derived from a hit (Xata's Whisper, Toxic Lash, Melee Duplicate). Has its own formula.                                                            |
| **Health layers**                    | Overguard, then Shields, then Health. Armor reduces Health damage only.                                                                                                      |
| **Damage attenuation (DA)**          | Boss-only adaptive damage reduction.                                                                                                                                         |
| **Snapshot**                         | Stats captured when a proc or projectile is created, later used by that DoT or explosion.                                                                                    |

## 3. The damage pipeline

The engine runs in two phases. **Build** turns a loadout into per-attack stats once per change. **Resolve** turns one hit into damage on one enemy, many times per simulated second. Keeping them separate is what makes the UI fast: editing a mod re-runs Build; the timeline re-runs Resolve.

&#91;embedded content: damage pipeline · Build once, Resolve per pellet, one shared enemy state\]

The enemy state is the hub: procs written by one pellet change the armor, amplifiers and crit bonuses that the next pellet's multipliers read.

### Phase A: Build (per attack, deterministic)

1. **Resolve the attack's base stats** from the weapon preset, then let Incarnon and unique-perk hooks patch them (section 14).
2. **Collect active effects** from every module (mods, arcanes, buffs, shards, companions, conditions, stacks) and sum them into buckets (section 5).
3. **Modded stats:** critical chance, critical damage, status chance, multishot, fire rate, charge time, magazine, reload, status duration, punch-through, range, ammo efficiency (cap 75%).
4. **Damage composition** (section 6): build the ordered element list, combine primaries into secondaries, add IPS bonuses, then quantize every type to 1/32 of base damage.
5. **Cache** the quantized per-type values and the proc weight table for the attack.

### Phase B: Resolve (per hit, stochastic or expected-value)

6. **Roll multishot:** integer pellets plus one extra with probability = fraction.
7. **Roll crit tier** per pellet, using crit chance plus target-dependent flat bonuses (Puncture stacks, weak-point crit chance).
8. **Roll status** per pellet: floor(SC) procs plus one with probability frac(SC); each proc picks a damage type by weight.
9. **Direct damage per type** through the multiplier chain below, then split across Overguard, Shields and Health.
10. **Extra hits** (Xata's Whisper, Toxic Lash, Melee Duplicate) spawn as separate instances.
11. **Apply procs:** create DoT snapshots, add stacks, update armor strip and amplifiers on the shared enemy state.
12. **Advance time:** fire-rate delay, burst delay, charge, reload, beam ramp, combo decay, proc ticks and expiries.

### The per-type multiplier chain (direct hit)

For each damage type _t_ in a hit:

```latex
D_t = Q_t \cdot (1 + F) \cdot \prod_i (1 + M_i) \cdot C_{tier} \cdot W \cdot V_{t,faction} \cdot A_{layer} \cdot (1 - \mathrm{DR}_{armor}) \cdot \prod_j (1 - \mathrm{DR}_j)
```

| Symbol   | Meaning                                                                                             | Section |
| -------- | --------------------------------------------------------------------------------------------------- | ------- |
| Q_t      | Quantized type value, already including base-damage and elemental buckets                           | 6       |
| F        | Faction damage bucket (Bane mods, Roar), additive within                                            | 5       |
| M_i      | Each independent final multiplier (Eclipse, Volt passive, sniper combo, Vauban passive ×1.25, etc.) | 5, 13   |
| C_tier   | Crit multiplier for the rolled tier, with headcrit and Cold adjustments                             | 7       |
| W        | Body-part / weak-point multiplier                                                                   | 11      |
| V        | Faction vulnerability: ×1.5 vulnerable, ×0.5 resistant, else ×1                                     | 10      |
| A_layer  | Viral (health) or Magnetic (shield/overguard) amplification                                         | 8       |
| DR_armor | 0.9 × min(armor, 2700) / 2700, health layer only, minimum 1 damage per type                         | 10      |
| DR_j     | Every other reduction (Eximus auras, mission modifiers, attenuation), multiplicative                | 10      |

The engine must record the value of every factor for every hit. That trace is what the UI's breakdown view and the in-game test comparisons read.

Open ordering questions (each needs a test, section 16): whether the 2,700 armor cap applies before or after strips **\[T\]**; whether overflow from a broken shield carries into health within one instance **\[T\]**; whether the proc weight table uses quantized or raw type values **\[T\]**.

## 4. Weapon presets: every base-stat variable

A weapon is data only: weapon-level fields plus a list of attacks. The wiki's per-attack schema (`AttackIndex`, `AttackName`, `AmmoCost`, `ShotSpeed`, `Trigger`, `ShotType`, `Multishot`, `PunchThrough`, `Range`, `StatusChance`, `Damage`) is the closest existing model ([Module:Weapons/data](https://wiki.warframe.com/w/Module:Weapons/data/primary?oldid=2812366)). Mirror it so the library can be seeded by script.

### Weapon-level fields

| Field                      | Type           | Notes                                                                                                                    |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`, `name`, `uniqueName` | string         | `uniqueName` = DE path, stable across renames                                                                            |
| `slot`                     | enum           | primary, secondary, melee, archgun, archmelee, companion, exalted, amp, railjack                                         |
| `class`                    | enum\[\]       | rifle, shotgun, sniper, bow, launcher, pistol, dual-pistol, thrown, beam, plus melee classes. Drives mod compatibility   |
| `compatTags`               | string\[\]     | Free tags mods filter on (e.g. `AOE`, `BEAM`, `PROJECTILE`, `INCARNON`)                                                  |
| `maxRank`                  | int            | 30, or 40 for Kuva/Tenet/Coda/Paracesis                                                                                  |
| `progenitor`               | {element, pct} | 25–60% of base damage, applied **as base damage** of that element ([Coda Weapons](https://wiki.warframe.com/w/Coda_wea)) |
| `innatePassives`           | Effect\[\]     | Plain-stat passives expressed as effects                                                                                 |
| `perkHooks`                | HookRef\[\]    | Unique mechanics that can't be plain effects (section 14)                                                                |
| `incarnon`                 | IncarnonDef?   | Forms and evolution tiers (section 14)                                                                                   |
| `ammo`                     | object         | magazine, maxAmmo, ammoCost, reloadTime, reloadStyle (`magazine`, `perShell`, `battery`), regenRate, regenDelay          |
| `zoomLevels`               | ZoomDef\[\]    | Per-zoom bonuses (headshot, crit) for scoped weapons                                                                     |
| `sniperCombo`              | object?        | Combo gain per hit, thresholds, duration, multipliers                                                                    |
| `melee`                    | object?        | range, comboDuration, followThrough, heavy wind-up, stance class                                                         |

### Attack-level fields (one per firing mode)

| Field                                          | Type                                                   | Notes                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `damage`                                       | map type→number                                        | All 20 types allowed (IPS, 4 primary, 6 secondary, Void, Tau, True, Cinematic, Finisher, ShieldDrain, HealthDrain, EnergyDrain)                                              |
| `trigger`                                      | enum                                                   | semi, auto, autoSpool, burst, charge, held, duplex, active                                                                                                                   |
| `shotType`                                     | enum                                                   | hitscan, projectile, aoe, continuous                                                                                                                                         |
| `multishot`                                    | number                                                 | Base pellets                                                                                                                                                                 |
| `critChance`, `critMultiplier`, `statusChance` | number                                                 | Status per pellet; flag shotguns whose displayed value needs conversion **\[T\]**                                                                                            |
| `fireRate`                                     | number                                                 | Attacks/s; semi-auto capped at 10 ([Fire Rate](https://wiki.warframe.com/w/Fire_Rate?oldid=2816297))                                                                         |
| `chargeTime`, `burstCount`, `burstDelay`       | number                                                 | Charge and burst timing                                                                                                                                                      |
| `spool`                                        | {shotsToMax, startRate}                                | Auto-spool weapons (Gorgon 9 shots, Soma 6, etc.)                                                                                                                            |
| `falloff`                                      | {start, end, minPct}                                   | Distance falloff, e.g. Exergis 100% to 49.2% over 30–60 m                                                                                                                    |
| `aoe`                                          | {radius, centerPct, edgePct, losRequired}              | Radial attacks                                                                                                                                                               |
| `beam`                                         | {rampStartPct, rampTime, decayDelay, decayTime, chain} | Default ramp 20%→100% over 0.6 s, decays after 0.8 s over 2 s; some beams start at 25–30% ([Continuous Weapon](https://wiki.warframe.com/w/Continuous_Weapon?veaction=edit)) |
| `punchThrough`, `range`, `projectileSpeed`     | number                                                 |                                                                                                                                                                              |
| `forcedProcs`                                  | ProcRef\[\]                                            | Procs applied on every hit                                                                                                                                                   |
| `linkedAttacks`                                | AttackRef\[\]                                          | e.g. direct hit spawns explosion; explosion may roll crit/status separately                                                                                                  |
| `flags`                                        | string\[\]                                             | `canHeadshot`, `canCrit`, `isAoE`, `ignoresGunCO`, `noFactionMods`, etc.                                                                                                     |

Example: a beam is just `trigger: held`, `shotType: continuous`, `fireRate: 12` (tick rate), `ammoCost: 0.5`, plus `beam.rampStartPct: 0.2`. Multishot on a beam merges same-target hits into one instance whose damage and status chance are the sums of the hits ([Continuous Weapon](https://wiki.warframe.com/w/Continuous_Weapon?oldid=2790979)). Model that as an attack flag `mergeMultishotHits`.

## 5. Modifier stacking: buckets and operations

Every bonus in the game is one of three operations on a named stat, and the engine should use the same three. The wiki documents DE's internal operation types ([Calculating Bonuses](https://wiki.warframe.com/w/Multiplicative_Stacking)):

| Op (internal name)  | Rule                                                              | Example                                             |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| `STACKING_MULTIPLY` | Percent bonuses on the same stat **add**, then multiply base once | Serration + Heavy Caliber: base × (1 + 1.65 + 1.65) |
| `MULTIPLY`          | Each source multiplies separately                                 | Two damage-resist sources: × 0.55 × 0.85            |
| `ADD`               | Flat value or percentage points, added after percent bonuses      | Entropy Burst: status chance + 20 pp                |

Generic stat formula, applied per bucket:

```latex
\text{stat} = \text{base} \cdot \Big(1 + \sum \text{STACKING\_MULTIPLY}\Big) \cdot \prod (1 + \text{MULTIPLY}) + \sum \text{ADD}
```

The order of mods in the build does not matter, **except** for elemental mods, whose slot order decides combinations (section 6).

### Bucket catalogue

Each row is one bucket the engine exposes. `Scope` says which damage it reaches: **D** direct hit, **P** proc DoT, **X** extra hit, **A** AoE.

| Bucket                                                  | Stacking                                               | Typical sources                                                                                                                                                                      | Scope                | Conf. |
| ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ----- |
| `damage.base`                                           | additive                                               | Serration, Hornet Strike, Pressure Point, Merciless/Deadhead/Dexterity arcanes, Vex Armor, Condition Overload (per status), Galvanized Aptitude/Savvy/Shot (per status, direct only) | D P X                | \[W\] |
| `damage.ips.{impact,puncture,slash}`                    | additive per type, scales existing type only           | Collision Force, Rending Strike                                                                                                                                                      | D                    | \[W\] |
| `damage.element[]`                                      | ordered list, not summed                               | 90% elemental mods, riven elements, progenitor element                                                                                                                               | D (+ own-type DoT)   | \[W\] |
| `damage.elementNoCombine`                               | additive with matching element, never combines         | Ability elemental buffs (Fireball Frenzy, Shock Trooper)                                                                                                                             | D                    | \[W\] |
| `damage.faction.{faction}`                              | additive (Bane + Roar + 25% Damage Blessing)           | Bane/Expel mods, Roar                                                                                                                                                                | D, P twice, X twice  | \[W\] |
| `damage.final.{id}`                                     | each independent multiply                              | Eclipse, Volt passive, Vauban ×1.25 vs incapacitated, sniper combo                                                                                                                   | D (per-source scope) | \[C\] |
| `crit.chance`                                           | additive % of base                                     | Point Strike, True Steel, Pistol Gambit                                                                                                                                              | D P                  | \[W\] |
| `crit.chanceCombo`                                      | % of base × (combo multiplier − 1)                     | Blood Rush                                                                                                                                                                           | D                    | \[W\] |
| `crit.chanceFlat`                                       | ADD after percent                                      | Arcane Avenger, Covenant, Puncture stacks on target                                                                                                                                  | D                    | \[W\] |
| `crit.chanceWeakPoint`                                  | conditional, on weak points only                       | Primary/Pistol Acuity                                                                                                                                                                | D                    | \[W\] |
| `crit.damage`                                           | additive % of base                                     | Vital Sense, Organ Shatter                                                                                                                                                           | D P                  | \[W\] |
| `crit.damageFlat`                                       | ADD to the multiplier                                  | Cold stacks on target (+0.10x to +1.0x)                                                                                                                                              | D                    | \[W\] |
| `crit.damageFinal`                                      | multiply after others                                  | Volt Electric Shield                                                                                                                                                                 | D                    | \[C\] |
| `status.chance` / `.chanceCombo` / `.chanceFlat`        | as crit chance                                         | Rifle Aptitude, Weeping Wounds, Entropy Burst                                                                                                                                        | D                    | \[W\] |
| `status.duration`                                       | additive                                               | Lingering Torment                                                                                                                                                                    | P                    | \[W\] |
| `status.damage`                                         | additive                                               | Elementalist mods                                                                                                                                                                    | P                    | \[W\] |
| `multishot`                                             | additive                                               | Split Chamber, Galvanized Chamber                                                                                                                                                    | D                    | \[W\] |
| `fireRate`                                              | additive                                               | Speed Trigger, Fury (attack speed)                                                                                                                                                   | time                 | \[W\] |
| `reload`, `magazine`, `ammoMax`, `ammoEfficiency`       | additive; efficiency capped 75%                        | Fast Hands, Magazine Warp                                                                                                                                                            | time                 | \[W\] |
| `weakPoint.damage`                                      | additive into the weak-point multiplier, ×1.5 on heads | Acuity mods, riven spliced trait                                                                                                                                                     | D                    | \[W\] |
| `heavy.*`, `combo.*`                                    | additive                                               | Corrupt Charge, Heavy Attack Efficiency, combo duration                                                                                                                              | melee                | \[W\] |
| `range`, `aoeRadius`, `punchThrough`, `projectileSpeed` | additive                                               | Primed Firestorm, Seeker                                                                                                                                                             | geometry             | \[W\] |
| `enemy.*` (debuffs)                                     | see section 10                                         | Corrosive Projection, Sonar, armor strips                                                                                                                                            | target               | \[W\] |

Two stacking traps to encode explicitly:

- **GunCO is not always additive.** Galvanized Aptitude/Savvy/Shot recalculate damage additively but omit the +damage term, so on some weapons they effectively multiply with Serration ([CO mechanic](<https://wiki.warframe.com/w/Condition_Overload_(Mechanic)?oldid=2806085>)). Treat this as a per-weapon flag `gunCOMode: additive | multiplicative | partial(x)`. Many non-hitscan weapons were reported to scale GunCO off a different base value **\[T\]**.
- **Multishot resolves sequentially.** Later pellets in one trigger pull already see statuses applied by earlier pellets, so CO/GunCO grow within a single shot (worked example on [Galvanized Savvy](https://wiki.warframe.com/w/Galvanized_Savvy)). The simulator must apply pellets one at a time, not as a batch.

## 6. Damage types, element combination and quantization

There are 20 damage types. Make the list a data file (`damageTypes.json`) with each type's proc, DoT behaviour and layer rules, so new types (Tau arrived in Update 37.0) are a data change.

| Group              | Types                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physical (IPS)     | Impact, Puncture, Slash                                                                                                                           |
| Primary elements   | Heat, Cold, Electricity, Toxin                                                                                                                    |
| Secondary elements | Blast (Heat+Cold), Corrosive (Electricity+Toxin), Gas (Heat+Toxin), Magnetic (Cold+Electricity), Radiation (Electricity+Heat), Viral (Cold+Toxin) |
| Special            | Void, Tau, True, Cinematic, Finisher, Shield Drain, Health Drain, Energy Drain                                                                    |

Combination table and type list: [Fandom Damage](https://warframe.fandom.com/wiki/Damage) (still current for these rules), [Elements](https://wiki.warframe.com/w/Elements).

### Element ordering rules

1. Elemental sources form an **ordered list** by mod slot, top-left first.
2. Two adjacent _different_ primaries combine into their secondary. A later mod of a primary that was already consumed adds to the secondary it formed.
3. **Innate** primary elements go **last**, unless a mod of the same element is equipped; then the innate element takes that mod's position.
4. **Kuva/Tenet with two innate elements** (progenitor + innate): order by Heat > Cold > Electricity > Toxin; the first goes second-to-last, the other last.
5. **Riven elements**: the last-listed elemental stat on the riven takes priority.
6. **Innate secondary elements** (Ogris, Stug) stay as they are and cannot combine further.
7. **Ability elemental buffs** never combine; they add to a matching element if present, otherwise stand alone.

Rules 1–6 are from [Fandom Damage](https://warframe.fandom.com/wiki/Damage) **\[C\]**; rule 7 from [Buff](https://wiki.warframe.com/w/Buff) **\[W\]**. Implement the combiner as a pure function `combine(orderedSources) → Map<finalElement, ratio>` with a test table of known builds.

### Values

- An elemental mod's value = mod % × **total** base damage, even for elements the weapon didn't have. IPS mods scale only the matching base type.
- Progenitor bonus is added as base damage of its element, so elemental mods and proc bases see it ([Coda Weapons](https://wiki.warframe.com/w/Coda_wea)).
- Base-damage mods (Serration bucket) scale everything, including elemental contributions:

```latex
\text{Total} = B \cdot \Big[1 + \sum E + \sum_{t \in IPS} \tfrac{b_t}{B} \cdot I_t\Big] \cdot (1 + \text{damage.base}) \cdot \text{Multishot}
```

(B = total base damage, E = elemental bonuses, b_t = base of IPS type t, I_t = its IPS bonus; [Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation).)

### Quantization

Each type is rounded to the nearest 1/32 of the attack's base damage before further multipliers ([Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation?oldid=2823041)) **\[W?\]**:

```latex
x_t = \frac{\text{type value}_t}{\text{modded base damage}}, \qquad Q(x) = \operatorname{sign}(x) \cdot \frac{\lfloor |x| \cdot 32 + 0.5 \rfloor}{32}, \qquad Q_t = Q(x_t) \cdot \text{modded base damage}
```

Implementation notes:

- Quantize the **ratio**, not the absolute value. The wiki contradicts itself on whether +Damage and Faction multiply before or after quantizing; on a ratio both readings give the same number, so the conflict is moot for those buckets.
- An element formed from several sources (e.g. 90% Cold + 90% Toxin = 180% Viral) is quantized once, as a sum.
- Small types can quantize to **zero**. The wiki's example: 1.73 Impact on a 173-damage attack becomes 0 (scale 5.406). Whether a zeroed type can still be picked as a proc is unknown **\[T\]**.
- Displayed numbers are rounded to the nearest integer at the end; keep full precision internally.
- Proc DoTs are **not** quantized; they use modded base damage directly.

## 7. Critical hits

Crit chance above 100% is not wasted: it raises the guaranteed tier, and the remainder is the chance of one tier more. Each pellet and each melee strike rolls on its own.

### Chance

```latex
CC = CC_{base} \cdot \big(1 + \textstyle\sum \text{relative} + \text{BloodRush} \cdot (\text{combo} - 1)\big) + \sum \text{flat}
```

Source: [Critical Hit](https://wiki.warframe.com/w/Critical_Damage) worked example, Gram with True Steel and Blood Rush at 7x combo: 15% × \[1 + 120% + 40% × 6\] = 69% **\[W\]**.

- **Flat** sources add after mods: Arcane Avenger, Harrow's Covenant (×4 on headshots, capped 50% body / 200% head), Puncture stacks on the target (+5% per stack, max +25%, not for AoE or abilities) ([Puncture](https://wiki.warframe.com/w/Damage/Puncture_Damage)).
- **Weak-point crit chance** (Acuity mods) applies only on weak-point hits. On a few weapons it multiplies instead of adding: CC_base × (1 + normal) × (1 + multiplicative), e.g. Kuva Chakkhurr reaching 675% ([community research](https://wiki.warframe.com/w/User:Xirel/Multiplicative_Crit)) **\[C\]**. Hotfix 38.5 fixed some of these cases, so model it as a per-weapon flag `critStacking: additive | multiplicative` and verify per weapon **\[T\]**.
- **Set crit chance** (Citrine's Crystallize sets 300%) overrides everything; model as an `override` op.

### Damage multiplier

```latex
CD = CD_{base} \cdot (1 + \textstyle\sum \text{relative}) + \text{Cold}_{flat}, \qquad CD_{hit} = CD \cdot H_{crit} \cdot \prod \text{final}
```

- **Cold on target** adds +0.10x at 1 stack, +0.05x per further stack, +0.50x at 9; Frozen (10 stacks) gives +1.0x. It is additive with crit-damage mods, applies before the tier is computed, and does not apply to AoE. Bosses and Overguard units cap at 4 stacks (+0.25x) ([Cold Damage](https://wiki.warframe.com/w/Freeze_Damage), [Damage 3.0/Cold](https://wiki.warframe.com/w/Damage_3.0/Cold_Damage)). Whether "+0.1x" is absolute or 10% of base is ambiguous **\[T\]**.
- **Headcrit** (H_crit = 2 on flagged parts) doubles the crit multiplier before tiers: exactly 2x on yellow crits, a little more on higher tiers ([Enemy Body Parts](https://wiki.warframe.com/w/Headshot)). Whether it doubles base or modded CD needs confirming **\[T\]**.
- **Final** crit multipliers (Volt's Electric Shield) multiply after everything else **\[C\]**.

### Tiers

```latex
\text{tier} = \lfloor CC \rfloor + \mathbb{1}[u < CC - \lfloor CC \rfloor], \qquad C_{tier} = 1 + \text{tier} \cdot (CD_{hit} - 1)
```

| Tier | Colour                     | Example at CD 3.0 |
| ---- | -------------------------- | ----------------- |
| 0    | white                      | 1x                |
| 1    | yellow                     | 3x                |
| 2    | orange                     | 5x                |
| 3+   | red, then red with ! marks | 7x, 9x, …         |

Because the expected tier equals CC, the **expected** crit multiplier is simply 1 + CC × (CD − 1). The expected-value engine mode can use that directly; the stochastic mode rolls tiers.

- **Vigilante set** mods add a chance to raise the rolled tier by one (up to 30% with all six), primaries only **\[C\]**.
- **Procs inherit** the crit tier and headshot of the hit that created them (section 8).

## 8. Status effects

Status is where most of the late-game damage comes from, and where the engine needs a real per-enemy state machine rather than a formula.

### Rolling procs

- Status chance uses the same shape as crit chance: SC_base × (1 + relative + WeepingWounds × (combo − 1)) + flat.
- Per pellet: floor(SC) procs, plus one more with probability frac(SC). Above 100%, one hit can apply several procs, including the same type twice ([Status Effect](https://wiki.warframe.com/w/Status)).
- Each proc picks one type, weighted by that type's share of the hit's damage.
- **Tau** stacks on the target raise status chance received by 10% per stack, up to 100% at 10 stacks; forced procs gain nothing ([Tau Damage](https://wiki.warframe.com/w/Damage/Tau_Damage)). Whether this multiplies SC or adds points is unclear **\[T\]**.
- **Forced procs** (stance hits, abilities, Hunter Munitions, Internal Bleeding, Secondary Cryogenic) bypass the roll; model them as event-triggered effects.
- Status duration: each proc's base duration × (1 + status.duration).

### Proc catalogue

| Type        | Effect on enemies                                                                                                                          | Stacking                   | Duration                  | Conf. |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------- | ----- |
| Impact      | Stagger; raises Parazon finisher threshold                                                                                                 | stacks                     | 6 s                       | \[W\] |
| Puncture    | Enemy deals −40% damage (+10%/stack, max 80%); +5% flat crit chance taken per stack (max 25%)                                              | 5, oldest replaced         | 10 s                      | \[W\] |
| Slash       | Bleed: 35% of base per tick as Cinematic damage, bypasses armor (not shields)                                                              | unlimited, independent     | 6 ticks after 1 s delay   | \[W\] |
| Heat        | Ignite: 50% per tick; strips armor up to 50% over 2 s; one merged instance per enemy                                                       | merged, refreshes all      | 6 s                       | \[W\] |
| Cold        | Slow; crit damage taken +0.10x…+0.50x; Frozen at 10 for 3 s (+1.0x), then 3 stacks remain                                                  | 10 (4 on bosses/Overguard) | 6 s each                  | \[W\] |
| Electricity | 50% per tick to target and enemies within 3 m; stun                                                                                        | unlimited, independent     | 6 s, first tick immediate | \[W\] |
| Toxin       | 50% per tick, bypasses shields                                                                                                             | unlimited, independent     | 6 ticks after 1 s delay   | \[W\] |
| Blast       | Each stack detonates for 30% of base after 1.5 s; at 10 stacks or on kill, all detonate early plus 300% per stack AoE in 5 m (cap 3000%)   | 10                         | 1.5 s fuse                | \[W\] |
| Corrosive   | Armor −26%, +6% per stack, max 80%                                                                                                         | 10                         | 8 s each                  | \[W\] |
| Gas         | 50% per tick in a cloud, 3 m radius +0.3 m per stack up to 6 m                                                                             | 10                         | 6 s, first tick immediate | \[W\] |
| Magnetic    | Shield and Overguard damage +100%, +25%/stack, max +325%; no shield regen; on break, forced Electricity proc of 3% max shield/OG per stack | 10, oldest replaced        | 6 s                       | \[W\] |
| Radiation   | Confusion; allies deal +100%…+550% to it                                                                                                   | 10                         | 12 s                      | \[W\] |
| Viral       | Health damage +100%, +25%/stack, max +325%                                                                                                 | 10                         | 6 s                       | \[W\] |
| Void        | Bullet attractor                                                                                                                           | —                          | 3 s                       | \[C\] |
| Tau         | Status chance vulnerability +10%/stack                                                                                                     | 10, oldest replaced        | 8 s each                  | \[W\] |

Sources: [Blast](https://wiki.warframe.com/Damage/Blast_Damage), [Magnetic](https://wiki.warframe.com/w/Magnetic_mods), [Viral](https://wiki.warframe.com/w/Damage/Viral_Damage), [Corrosive](https://wiki.warframe.com/w/Damage/Corrosive_Damage?oldid=2804597), [Cold](https://wiki.warframe.com/w/Frozen), [Heat](https://wiki.warframe.com/w/Fire), [Slash](https://wiki.warframe.com/w/Slash), [status overview](https://wiki.warframe.com/w/Damage_type), [shield/armor bypass note](https://wiki.warframe.com/w/Damage). Since Update 36, Eximus with Overguard are immune to crowd control until it breaks, but damage procs still matter **\[T\]**.

### DoT tick formula

```latex
\text{tick} = c \cdot MB \cdot (1 + F) \cdot (1 + S_{dmg}) \cdot (1 + E_{type}) \cdot C_{tier} \cdot H \;\; \underbrace{\cdot \, (1 + F) \cdot V_{type} \cdot A_{viral} \cdot (1 - DR_{armor})}_{\text{at the target}}
```

| Symbol    | Value                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| c         | 0.35 Slash; 0.5 Heat, Toxin, Electricity, Gas; Blast 0.3 per stack and 3.0 AoE                                                                            |
| MB        | Modded base damage, **not** quantized, not affected by IPS mods                                                                                           |
| F         | Faction bucket, applied **twice** (1.30² = +69% for a 30% Bane, 1.55² = +140% for Primed) ([Electricity](https://wiki.warframe.com/w/Electricity_Damage)) |
| S_dmg     | Status damage bucket (Elementalist mods)                                                                                                                  |
| E_type    | The matching elemental bonus for Heat/Toxin/Electricity/Gas; none for Slash and Blast                                                                     |
| C_tier, H | Crit tier and headshot of the creating hit; Sonar-style added weak points do not carry ([Slash](https://wiki.warframe.com/w/Slash))                       |
| V_type    | Faction vulnerability for the proc's damage type (Cinematic is neutral, so Bleed ignores Infested's Slash weakness **\[T\]**)                             |
| A_viral   | Viral amplification on health; armor applies except to Slash                                                                                              |

Worked check from the wiki ([Toxin](https://wiki.warframe.com/w/Poison_Damage)): base 100, +165% damage, 30% Bane: MB × (1+F) = 344.5; DoT multiplier 1.9 × 1.9 × 1.3 = 4.693; tick = 0.5 × 344.5 × 4.693 = 808.37. The excerpt doesn't show what the two 1.9 factors are (one is a 90% Toxin bonus; the other is likely status damage or a second Toxin source). Read the full example before adopting it as unit test #1.

**Tick count:** ticks = ⌊D − 1⌋ + 1 with D = 6 s × (1 + status duration); e.g. D = 7.8 s gives 7 ticks ([Fandom Damage](https://warframe.fandom.com/wiki/Damage)) **\[C\]**.

**Heat is special.** All Heat procs on an enemy merge into one instance: each new proc adds its tick value and refreshes every stack to the longest duration. Bonuses snapshot from the _first_ proc ("heat inherit"), so an unmodded first Heat proc (e.g. from an ability) drags the whole stack down ([Heat](https://wiki.warframe.com/w/Fire_Damage)). Armor strip ramps over 2 s, and armor returns every 1.5 s over 6 s after the proc ends.

**Gas and secondary DoTs**: secondary-element procs scale with their own combined bonus, not their components' ([guide](https://cw-warframe-guides.github.io/guides/mod-damage/)) **\[C\]**. Exact E_type for Gas from innate vs modded sources needs testing **\[T\]**.

## 9. Time: fire rate, multishot, reload and sustained DPS

The engine should output three numbers per attack, matching how players think: **per shot**, **burst DPS** (never reloading) and **sustained DPS** (with reloads). A fourth, time-to-kill against the chosen enemy, comes from the timeline simulator.

### Closed-form rates

From [Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation) and [Fire Rate](https://wiki.warframe.com/w/Fire_Rate?oldid=2816297):

| Quantity                                                  | Formula                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Modded stat                                               | base × (1 + bonuses)                                                                              |
| Modded time (reload, charge)                              | base time ÷ (1 + speed bonuses)                                                                   |
| Effective fire rate: auto, auto-spool, semi, duplex, held | modded fire rate (semi-auto capped at 10/s before bonuses)                                        |
| Effective fire rate: charge                               | 1 ÷ (charge time + 1 ÷ fire rate)                                                                 |
| Effective fire rate: bows, Epitaph                        | 1 ÷ (charge time + reload time)                                                                   |
| Effective fire rate: Lanka                                | 1 ÷ charge time                                                                                   |
| Effective fire rate: burst                                | burst count ÷ (1 ÷ fire rate + (count − 1) × burst delay); burst delay ignores negative fire rate |
| Charge time floor                                         | at most 10× base (reached at −90% fire rate)                                                      |
| Shots per magazine                                        | magazine ÷ (ammo cost × (1 − ammo efficiency)); efficiency capped at 75% since Hotfix 44.1.3      |
| Shooting proportion                                       | N ÷ (N + EFR × reload), N = shots per magazine (Vectis: N − 1 in the denominator)                 |
| Burst DPS                                                 | average shot × EFR                                                                                |
| Sustained DPS                                             | burst DPS × shooting proportion                                                                   |
| Lifetime damage                                           | average shot × N × (1 + max ammo ÷ magazine)                                                      |

Whether bows still get double the benefit from fire-rate mods (an old, long-standing rule) is not stated on the current page **\[T\]**.

### Multishot

Projectiles = base multishot × (1 + bonuses). The integer part always fires; the fraction is the chance of one more, so 2.8 means 2 pellets plus an 80% chance of a third ([Multishot](https://wiki.warframe.com/w/Multihit)). Each pellet rolls crit and status independently. Extra pellets cost no extra ammo.

### Beams and spool weapons

- Beams: damage ramps from 20% (some 25–30%) to 100% over 0.6 s on a target; 0.8 s after the beam leaves, it decays back over 2 s; 0.5 ammo per tick for most beams ([Continuous Weapon](https://wiki.warframe.com/w/Continuous_Weapon?veaction=edit), [Quanta](https://wiki.warframe.com/Quanta)). Ramp is per target.
- Auto-spool: fire rate climbs over the first few shots (Gorgon 9, Soma 6, Soma Prime 4). Store `shotsToMax` and `startRate` per weapon; the wiki lists shot counts but not start rates **\[T\]**.
- Battery weapons regenerate ammo instead of reloading; model as `reloadStyle: battery` with regen rate and delay.

### The timeline simulator

Closed forms are fine for the arsenal-style stat panel, but procs, stacking conditions and kills need an event queue:

- Events: `fire`, `pelletHit`, `procTick`, `procExpire`, `blastFuse`, `reloadStart/End`, `buffExpire`, `comboDecay`, `enemyDeath`.
- One shared enemy state per target (layers, armor, stacks, status list), so the direct hit and its explosion see each other's procs, unlike warframe-damage.com.
- Two modes: **expected value** (deterministic: fractional pellets, expected crit tier, fractional procs) and **Monte Carlo** (seeded RNG, N runs, report mean and percentiles). Same code path, different `Roller` implementation.

## 10. The enemy model

An enemy is also a preset plus modules: base stats, a faction profile, a scaling profile, body parts, and optional hooks for special damage reduction. Mission settings (level, Steel Path, modifiers) are modules applied on top.

### Enemy preset fields

`faction`, `baseLevel`, `baseHealth`, `baseShield`, `baseArmor`, `baseOverguard`, `scalingProfile` (usually = faction), `bodyParts[]` (section 11), `statusCaps` (bosses and Overguard units cap Cold at 4), `flags` (`boss`, `eximus`, `hasAttenuation`), `drHooks[]`. Seed from WFCD's Enemy category and the wiki's enemy pages.

### Faction damage modifiers (Damage 3.0, since Update 36.0)

Vulnerable = ×1.5, resistant = ×0.5, everything else ×1 ([Elements](https://wiki.warframe.com/w/Elements)). Store as `factions.json`.

| Faction            | Vulnerable (×1.5)      | Resistant (×0.5) |
| ------------------ | ---------------------- | ---------------- |
| Grineer            | Impact, Corrosive      | —                |
| Kuva Grineer       | Impact, Corrosive      | Heat             |
| Scaldra            | Impact, Corrosive      | Gas              |
| Corpus             | Puncture, Magnetic     | —                |
| Corpus Amalgam     | Electricity, Magnetic  | Blast            |
| Techrot            | Magnetic, Gas          | Cold             |
| Infested           | Slash, Heat            | —                |
| Infested Deimos    | Blast, Gas             | Viral            |
| Orokin (Corrupted) | Puncture, Viral        | Radiation        |
| Sentient           | Cold, Radiation        | Corrosive        |
| Narmer             | Slash, Toxin           | Magnetic         |
| The Murmur         | Electricity, Radiation | Viral            |
| Zariman            | Void                   | —                |

Compiled from [Dexerto](https://dexerto.com/gaming/warframe-every-damage-type-explained-3016992) and cross-checked against the wiki's per-type efficacy boxes ([Cold](https://wiki.warframe.com/w/Freeze_Damage), [Magnetic](https://wiki.warframe.com/w/Magnetic_mods), [Viral](https://wiki.warframe.com/w/Damage/Viral_Damage), [Blast](https://wiki.warframe.com/Damage/Blast_Damage), [Heat](https://wiki.warframe.com/w/Fire_Damage), [Electricity](https://wiki.warframe.com/w/Electrical_Damage)). Anarchs also take ×1.5 Electricity; their full profile is unknown. Faction **mods** follow different groupings: Grineer mods work on Kuva Grineer but not Corrupted, Narmer or Scaldra; Infested mods don't work on Techrot ([Faction Damage Bonus](https://wiki.warframe.com/w/Faction_damage)). Store `factionModGroup` separately from `damageProfile`.

### Health layers

Damage goes Overguard → Shields → Health.

- **Armor** reduces Health damage only; shields and Overguard ignore it.
- **Toxin** (hit and proc) bypasses shields. **Slash** procs bypass armor but not shields.
- **True** damage hits Health and Overguard and ignores armor. **Finisher** and **Cinematic** ignore armor.
- **Viral** amplifies Health; **Magnetic** amplifies Shields and Overguard.

### Armor

```latex
DR_{armor} = 0.9 \cdot \frac{\min(\text{armor}, 2700)}{2700}
```

Enemy armor is capped at 2,700 (90% DR). Armored enemies that would spawn below 200 armor start at 200. Every damage type deals at least 1 when reduced by armor ([Armor](https://wiki.warframe.com/w/Armor)).

Strip stacking: most strips remove a % of **maximum** armor; Heat and Corrosive remove a % of **current** armor, so they multiply with each other and with other strips; ability strips work off total armor. Fusion Strike, Seeking Shuriken, Sonic Fracture, Fire Blast and others are listed on the same page. Model each strip as `{kind: pctMax | pctCurrent | flat, value, permanent}` and apply in a documented order **\[T\]**.

### Level scaling

Notation: d = current level − base level; S = smoothstep 3T² − 2T³ with T clamped to \[0, 1\]. Every curve blends a low-level f1 and a high-level f2 ([Enemy Level Scaling](https://wiki.warframe.com/w/Enemy_Level_Scaling)):

```latex
\text{mult}(d) = f_1(d) \cdot (1 - S) + f_2(d) \cdot S, \qquad T = \frac{d - 70}{10}
```

| Stat / profile                           | f1 (d < 70)        | f2 (d > 80)       |
| ---------------------------------------- | ------------------ | ----------------- |
| Health: Grineer, Scaldra                 | 1 + 0.015 d^2.12   | 1 + k₁ d^0.72     |
| Health: Corpus                           | 1 + 0.015 d^2.12   | 1 + k₂ d^0.55     |
| Health: Infested                         | 1 + 0.0225 d^2.12  | 1 + k₃ d^0.72     |
| Health: Corrupted                        | 1 + 0.015 d^2.1    | 1 + k₁ d^0.685    |
| Health: Murmur, Sentient, unaffiliated   | 1 + 0.015 d^2      | 1 + k₁ d^0.5      |
| Health: Techrot                          | 1 + 0.02 d^2.12    | 1 + 15.1 d^0.7    |
| Shields: Corpus                          | 1 + 0.02 d^1.76    | 1 + 2 d^0.76      |
| Shields: Grineer                         | 1 + 0.02 d^1.75    | 1 + 1.6 d^0.75    |
| Shields: Corrupted                       | 1 + 0.02 d^1.75    | 1 + 2 d^0.75      |
| Shields: Techrot                         | 1 + 0.02 d^1.76    | 1 + 3.5 d^0.76    |
| Armor: all                               | 1 + 0.005 d^1.75   | 1 + 0.4 d^0.75    |
| Overguard (uses L − 1; blend over 45–50) | 1 + 0.0015 (L−1)^4 | 1 + 260 (L−1)^0.9 |

The page's health coefficients came through garbled as "2455", "3055", "3655". They are almost certainly k₁ = 24√5/5 ≈ 10.733, k₂ = 30√5/5 ≈ 13.416, k₃ = 36√5/5 ≈ 16.100, but confirm from the page source before coding **\[W?\]**. The page itself calls these formulas unconfirmed.

Eximus get an extra tiered health multiplier M(L) (1 at L ≤ 15 rising to 6 above L 100) and base health max(1.1 BH, 0.25 (BH + 900) M) for armored/shielded units, 0.375 instead of 0.25 otherwise. Enemy level caps at 9,999.

### Steel Path

+100 levels in normal missions (+50 Archwing/Empyrean/Railjack), health ×2.5, shields ×2.5, armor not increased since Update 36 ([Steel Path](https://wiki.warframe.com/w/The_Steel_Path)).

### Other damage reduction (all multiplicative)

- Eximus auras, e.g. Guardian Eximus 90% DR ([Damage Reduction](https://wiki.warframe.com/w/Damage_Attenuation)).
- Mission modifiers: Entropic Eximus take −90% from non-melee (−75% from Operators) since Update 44 ([Hotfix 44.0.1](https://forums.warframe.com/topic/1524660-iceblade-of-narin-hotfix-4401/)); Archimedea and Icebind binds such as "Heavy Warfare" (−90% from non-heavy weapons) ([Update 44.1](https://forums.warframe.com/topic/1527298-update-4410-iceblade-of-narin-the-icebind/)).
- **Damage attenuation**: since Update 40 reserved for true bosses with HUD health bars, proportional to max health, and tracked per player ([Hotfix 40.0.2](https://www.warframe.com/patch-notes/switch/40-0-2), [Juggernaut Behemoth](https://wiki.warframe.com/Juggernaut_Behemoth)). Implement as a stateful `drHook` per boss.
- Empyrean: archguns and archmelee deal 10/11 to space enemies.
- Sentient adaptation and Lich/Sister resistances: stateful hooks.

## 11. Hit location, AoE and geometry

Where a shot lands is a per-hit input, not a global toggle. The test harness should let the user say "100% headshots", "body only", or a mix such as "60% head, 40% body".

### Body parts

Each enemy part carries a multiplier and three independent flags ([Enemy Body Parts](https://wiki.warframe.com/w/Weak_Point)):

| Flag        | Effect                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `weakPoint` | Applies the part multiplier and weak-point damage bonuses                                                                     |
| `headshot`  | Weak-point bonuses apply at 1.5× rate; triggers headshot-conditional effects                                                  |
| `headcrit`  | Critical hits get the ×2 crit multiplier (section 7); a narrower set than heads, e.g. Scaldra Dedicant's 1x upper body has it |

```latex
W = m_{part} + k \cdot \sum \text{weakPoint.damage}, \qquad k = \begin{cases} 1.5 & \text{headshot part} \\ 1.0 & \text{otherwise} \end{cases}
```

Worked examples from the wiki: a 3x head with two weak-point bonuses of 3.5 and 0.75 gives 3 + 1.5 × 4.25 = **9.375x**; the same bonuses on a 1x non-head weak point give **5.25x**; a max Acuity on Butcher's 3x head gives 3 + 1.5 × 3.5 = **8.25x** ([Pistol Acuity](https://wiki.warframe.com/w/Pistol_Acuity?veaction=edit)). Acuity applies at only 1.0x on MOA rears, Bursa rear panels, The Severed Warden and Scaldra Harbinger.

Typical part multipliers: humanoid heads 3x, many MOA/backpack weak points 3x, some heads 1x or 0.5x (e.g. Amalgam Machinist), and 0x invulnerable bodies on targets like the Condrix ([body part tables](https://wiki.warframe.com/w/Enemy_Body_Parts?oldid=2554643)). Store `bodyParts[]` per enemy; default to `{body: 1}` and `{head: 3, weakPoint, headshot, headcrit}`.

- **Added weak points** (Banshee's Sonar, Detect Vulnerability) use the highlighted part's own multiplier and head/body criteria, and boost the direct hit only, not DoTs ([Slash](https://wiki.warframe.com/w/Slash)).
- **Procs** inherit the headshot multiplier of the hit that created them; DoTs otherwise land on the torso.
- Headshot-multiplier bonuses that aren't labelled "weak point damage" (e.g. Deadhead's +30% headshot multiplier) need a test to see whether they share the weak-point bucket **\[T\]**.

### AoE

- Radial damage falls off linearly from `centerPct` at the origin to `edgePct` at the radius; Blast's status detonation has no falloff.
- What AoE does **not** get: GunCO bonuses, Puncture's flat crit chance, Cold's crit damage bonus, and normally headshots. Whether a given AoE rolls its own crit and status is a per-attack flag.
- Direct hit and AoE are separate instances with separate status rolls (e.g. Quanta: "initial hit and explosion apply status separately" ([Quanta](https://wiki.warframe.com/Quanta))), but they act on the same enemy state.

### Distance and penetration

- Distance falloff per attack: full damage to `start`, linear to `minPct` at `end` (Exergis: 100% to 49.2% between 30 and 60 m) ([Exergis](https://wiki.warframe.com/Exergis)). Expose distance as a test input.
- Punch-through lets one projectile hit several enemies; each is its own instance. Not needed for single-target DPS; needed later for crowd scenarios.

## 12. Melee specifics

Melee reuses the whole pipeline. What it adds is a **combo counter** that scales chance stats on every hit and damage on heavy attacks, and **stances** that define the hit sequence.

### Combo counter

| Combo hits      | Multiplier                                            |
| --------------- | ----------------------------------------------------- |
| 0–19            | 1x                                                    |
| 20              | 2x                                                    |
| 40              | 3x                                                    |
| … every 20 hits | +1x                                                   |
| 220+            | 12x (cap; a few weapons such as Venka Prime show 13x) |

Source: [Melee Combo](https://wiki.warframe.com/w/Melee_Combo?oldid=2817078), [Venka Prime report](https://forums.warframe.com/topic/1147634-blood-rush-crit-chance-multiplier-and-venka-prime/).

- The combo multiplier scales **heavy attacks** (2x–12x) and certain abilities, not normal swings ([Heavy Attack Efficiency](https://wiki.warframe.com/w/Heavy_Attack_Efficiency)).
- Normal swings benefit through **Blood Rush** (crit chance) and **Weeping Wounds** (status chance), both scaling with (combo − 1) inside the relative bucket (section 7).
- A heavy attack spends 100% of the counter, less with Heavy Attack Efficiency (capped at 90%). Without efficiency, rebuilding takes 3 s to 7x and 5.5 s to 12x; Initial Combo builds rebuild at 40 combo/s ([Melee Combo](https://wiki.warframe.com/w/Combo_Count), [Initial Combo](https://wiki.warframe.com/w/Initial_Combo)).
- Combo decays after the combo duration expires; model it as a timeline event.

### Stances and attack types

- A **stance combo** is a sequence of hits, each with its own damage multiplier, timing and possibly forced procs. The DE arsenal doesn't show these; the wiki tabulates them per stance ([forum note](https://forums.warframe.com/topic/1179352-melee-mods-damage-system-arsenal-ui-errors/)). Data shape: `stance.combos[].hits[] = {mult, time, forcedProcs, aoe?}`.
- **Attack speed** is the melee fire rate; DPS ≈ average hit × attack speed ÷ base combo length ([Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation)).
- **Heavy attack**: own damage value per weapon, wind-up time (reduced by wind-up speed), consumes combo.
- **Slam / heavy slam**: radial damage plus Lifted status; **slide** and **aerial** attacks: own multipliers. Treat each as an attack on the weapon preset.
- **Glaive throws** and explosions are attacks too; CO applies to them, though reports say inconsistently ([bug thread](https://forums.warframe.com/topic/1237073-condition-overload-gives-significantly-less-damage-on-glaive-throws-and-explosions/)) **\[T\]**.

### Melee-only modules to support early

Condition Overload (+80% per unique status type on the target, in the base-damage bucket: Base × \[1 + damage mods + 0.8n\] × (1 + elemental) ([Condition Overload](https://wiki.warframe.com/Condition_Overload))), Blood Rush, Weeping Wounds, Gladiator set, Corrupt Charge (initial combo), Melee Duplicate (an extra hit at 100%, faction applied once, section 13), Melee Influence, Melee Crescendo, faction mods, Elementalist mods.

Exalted melee (Excalibur's Exalted Blade, Valkyr's Hysteria, etc.) runs through the same model, but some values scale with Ability Strength; give them a `scalesWith: abilityStrength` field.

## 13. Conditional and stacking effects

Most of what makes a build strong is conditional: on kill, on headshot, on status, per combo tier. These are still plain effects; they just carry a **condition** and **stack** model. Every module in this section should be expressible without code.

### Condition model

```
condition = {
  trigger: 'always' | 'onKill' | 'onHeadshot' | 'onWeakPointKill' | 'onCrit' | 'onStatus:<type>' |
           'onReload' | 'onShieldBreak' | 'perStatusTypeOnTarget' | 'perComboTier' | 'whileAiming' | ...,
  stacks: { max, perTrigger, decay: 'all' | 'one', duration },
  target: 'self' | 'enemy',
}
```

In the stat panel, the user picks one of three modes per conditional module: **off**, **assume max stacks** (or a chosen count), or **simulate** (the timeline fires the trigger and tracks stacks). The breakdown must show which mode each effect ran in.

### Representative modules (seed the library with these)

| Module                | Effects                                                                                              | Notes / source                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Galvanized Aptitude   | status.chance +80%; on kill, damage.base +40% per status type on target, 2 stacks, 20 s, direct only | [CO mechanic](<https://wiki.warframe.com/w/Condition_Overload_(Mechanic)>)                                                                       |
| Galvanized Shot       | same pattern, 3 stacks (+120% per status)                                                            | same                                                                                                                                             |
| Condition Overload    | damage.base +80% per status type on target                                                           | melee                                                                                                                                            |
| Roar                  | damage.faction.all +X% (scales with strength; reduced when subsumed)                                 | faction bucket, double-dips DoTs ([Faction Damage](https://wiki.warframe.com/w/Faction_damage))                                                  |
| Eclipse               | damage.final +200% on Mirage; subsumed version multiplicative 30%                                    | [DE forum](https://forums.warframe.com/topic/1386010-update-on-the-mirage-eclipse-changes/) **\[C\]**                                            |
| Vex Armor (Fury)      | damage.base +X%                                                                                      | additive with Serration ([Calculating Bonuses](https://wiki.warframe.com/w/Calculating_Bonuses?diff=0))                                          |
| Harrow Covenant       | crit.chanceFlat, ×4 on headshots, cap 50% / 200%                                                     |                                                                                                                                                  |
| Volt Electric Shield  | crit.damageFinal ×2, electricity bonus                                                               | **\[C\]**                                                                                                                                        |
| Primary Frostbite     | on Cold status: +3% crit damage, +2.25% multishot, 12 s, up to 40 stacks                             | [forum](https://forums.warframe.com/topic/1383011-primary-frostbite-and-primary-merciless-work-differently-descriptions-are-identical) **\[C\]** |
| Secondary Cryogenic   | on Puncture proc: apply 3 Cold stacks within 15 m                                                    | added Update 43 ([patch notes](https://www.warframe.com/en/patch-notes/switch/43-0-0))                                                           |
| Narin Cold Ammo Packs | temporary Cold element on primary/secondary                                                          | added Update 44; "Elemental Ammo" ([U44 wiki](https://wiki.warframe.com/w/Update_44:_Iceblade_of_Narin?oldid=2822042))                           |
| Damage Blessing       | damage.faction.all +25%, 3 h                                                                         | Relay font                                                                                                                                       |

### Extra hits

Xata's Whisper, Toxic Lash, Silken Stride, Resupply, Demonium, Reconifex's Active Reload, Melee Duplicate and Primary Debilitate create **separate** damage instances. They don't change the weapon's damage distribution ([Extra Hit](https://wiki.warframe.com/w/Extra_Hit)):

```latex
\text{ExtraHit} = \text{WeaponHitDamage} \cdot p \cdot (1 + F)
```

- WeaponHitDamage already includes crit, body-part and external multipliers, so faction counts twice; DoTs from the extra hit add a third.
- Xata's Whisper (17/23/23/26% Void) rolls Void procs at the weapon's status chance; its extra hit can't crit on its own. Toxic Lash (20–30% Toxin, doubled on melee) always procs Toxin.
- Melee Duplicate copies the hit at 100%, rolls crit and status independently, and applies faction once.
- Each multishot pellet triggers its own extra hit; a killing hit triggers none.
- Matching elemental bonuses on the weapon count toward the extra hit's DoT; pre-combined elements don't.

Model extra hits as an effect type `spawnInstance {pct, damageType, procRule, critRule, factionRule}`, not as damage buckets.

### Other module families to support

Archon Shards (plain stat effects; some are weapon-relevant), companion buffs (Smeeta Charm and similar), Focus nodes, auras (Corrosive Projection as an enemy armor debuff), set bonuses (Vigilante, Gladiator), and **Rivens**: up to four arbitrary stats. Since Hotfix 44.1.3 dispositions are gone and every riven rolls as if disposition were 1.2; Update 44.1 added one optional _spliced trait_ that fuses two stats (e.g. +274.1% Weak Point Damage) ([summary](https://patched.gg/games/warframe/iceblade-of-narin-the-icebind-hotfix-4413), [Update 44.1](https://forums.warframe.com/topic/1527298-update-4410-iceblade-of-narin-the-icebind/)). A riven is therefore just a user-authored module with up to five effects.

## 14. Escape hatches: Incarnons, unique perks, adversary weapons

The rule: **if it can be said as effects, say it as effects; only reach for a hook when it can't.** Most Incarnon perks turn out to be plain effects. The hook API exists for the remainder, so the core engine never grows weapon-specific branches.

### What can stay data

- **Kuva / Tenet / Coda progenitor bonus**: one element at 25–60% of base damage, added as base damage; Valence Fusion caps it at 60% and rounds ≥58% up ([Tenet Weapons](https://wiki.warframe.com/w/Tene), [Valence Fusion](https://wiki.warframe.com/w/Valence_bonus)). Weapon field `progenitor: {element, pct}`; the user edits pct.
- **Most Incarnon evolution perks**: stat changes ("Incarnon Form gains increased damage, critical chance and critical multiplier", "+40% direct damage per status type") are ordinary effects with a condition `incarnonFormActive` or `always` ([Lato Incarnon](https://warframe.fandom.com/wiki/Lato_Incarnon_Genesis)).
- **Incarnon Form** itself: an extra **attack** on the weapon preset with its own stats and ammo. Guns charge it via weak-point hits (some via direct hits); melee via a heavy attack at 5x–6x combo, lasting 90–180 s ([Incarnon](https://wiki.warframe.com/w/Incarnon?oldid=2730114), [Incarnon mechanics](https://wiki.warframe.com/w/Incarnon?oldid=2785613)). Weapons have 5 evolutions (Genesis: 4 tracked), the later ones offering 2–3 mutually exclusive perks.

```
incarnon = {
  form: AttackDef,                       // the transformed attack
  charge: { source: 'weakPointHit' | 'directHit' | 'heavyAtCombo', perHit, max },
  evolutions: [ { tier: 2, choices: [ Module, Module, Module ] }, ... ],
}
```

### What needs a hook

Examples of mechanics that don't reduce to bucket effects: Kohm's spool adding pellets while splitting status chance, Atomos-style beam chaining with per-target ramp, Laetum's Overwhelming Attrition (+1200% when every hit is a crit), Obex's radial burst per finisher hit, ricochet, Kuva Nukor's extra proc, "last bullet deals +100% × magazine" style effects.

Hook API (pure functions of an immutable context, so they stay testable and sandboxable):

| Hook                           | Called              | May return                                |
| ------------------------------ | ------------------- | ----------------------------------------- |
| `patchAttack(ctx, attack)`     | Build, per attack   | modified attack stats                     |
| `extraEffects(ctx)`            | Build               | additional effects for buckets            |
| `onBeforeHit(ctx, hit)`        | Resolve, per pellet | modified hit (crit, multipliers, targets) |
| `onAfterHit(ctx, hit, result)` | Resolve             | spawned instances, procs, stack changes   |
| `onEvent(ctx, event)`          | Timeline            | scheduled events, state changes           |

Hooks live in a registry keyed by id (`weapon.kohm.spool`, `perk.laetum.attrition`). Ship hooks as TypeScript modules in the repo; superusers get the data layer (effects, attacks, enemies) without code. A later phase could allow user hooks in a sandbox, but don't plan on it now.

### Rivens

Not an escape hatch any more: a riven is a module the user types in (up to 4 stats plus an optional spliced trait). Disposition no longer exists (section 13).

## 15. Architecture sketch

&#91;embedded content: architecture · library → engine → app, hooks inside the engine\]

Read it top to bottom: every source is normalised into one versioned library; the engine reads only the library and the hook registry; the app talks to the engine through a worker and never computes damage itself.

### Packages (monorepo)

```
packages/
  data/        versioned JSON library + zod schemas
               damageTypes.json  factions.json  buckets.json
               weapons/  mods/  arcanes/  buffs/  enemies/  stances/
  importers/   scripts: wiki Lua → schema, Public Export, WFCD
  engine/      pure TS, no React or DOM dependencies
    build/     collectEffects, buckets, stats, combineElements, quantize
    resolve/   rollers (expected | seeded), hit, layers, extraHits
    timeline/  eventQueue, enemyState, procs, fire/reload/beam/combo
    hooks/     registry + built-in hooks
    trace/     per-factor breakdown records
  app/         React (Vite), state store, worker bridge, views
  tests/       unit, property, golden fixtures
```

### Core types

```ts
type Op = "STACKING_MULTIPLY" | "MULTIPLY" | "ADD" | "OVERRIDE";

interface Effect {
  bucket: string; // 'damage.base', 'crit.chanceFlat', 'damage.faction.grineer'
  op: Op;
  value: number | Expr; // Expr: per stack, per combo tier, per status type, × abilityStrength
  scope?: ("direct" | "proc" | "extraHit" | "aoe")[];
  condition?: Condition; // section 13
  filter?: {
    attackTags?: string[];
    damageTypes?: DamageType[];
    bodyPart?: "head" | "weakPoint";
  };
}

interface Module {
  id: string;
  kind:
    | "mod"
    | "arcane"
    | "buff"
    | "shard"
    | "companion"
    | "aura"
    | "riven"
    | "enemyDebuff"
    | "mission";
  name: string;
  rank?: { current: number; max: number; perRank: "linear" | number[] };
  compat: { slots: Slot[]; classes?: WeaponClass[]; tags?: string[] };
  exclusiveGroup?: string; // e.g. Serration vs Amalgam Serration
  effects: Effect[];
  spawns?: SpawnInstance[]; // extra hits
  hooks?: HookRef[];
  gameVersion: string;
}

interface Scenario {
  build: {
    weaponId: string;
    modules: ModuleInstance[];
    elementOrder: string[];
  };
  enemy: {
    id: string;
    level: number;
    steelPath: boolean;
    modifiers: ModuleInstance[];
  };
  aim: { head: number; body: number; weakPoint?: string };
  distance: number;
  duration: number;
  mode: "expected" | "montecarlo";
  seed?: number;
  runs?: number;
}

interface HitTrace {
  t: number;
  pellet: number;
  factors: Record<string, number>; // every multiplier in the chain, by name
  perType: Partial<Record<DamageType, number>>;
  layer: "overguard" | "shield" | "health";
  procs: ProcRef[];
}
```

**Buckets are data too.** `buckets.json` declares each bucket's default op, scope and the pipeline stage that consumes it. The engine reads that table rather than hard-coding the multiplier chain, so a new kind of multiplier is a data change plus a test.

Rank scaling for most mods is linear in rank, value × (rank + 1) / (maxRank + 1) **\[C\]**; store explicit per-rank arrays where it isn't.

### App structure (no UI design yet)

- Engine runs in a Web Worker. The app posts a `Scenario` and receives metrics plus the trace. Build re-runs on every edit (target under 1 ms); the timeline is debounced.
- One state store holds a list of scenarios, so side-by-side comparison is just N scenarios sharing an enemy. Builds serialise into the URL for sharing.
- Library loads lazily per slot. User-authored modules live in IndexedDB with JSON export/import, using the same schema as the shipped library.
- TypeScript strict; zod validation on load; the library's game version is visible in the app.

## 16. Validation plan and in-game test protocol

Three layers of tests, from cheapest to most authoritative:

1. **Unit tests from documented examples.** Every worked example cited in this doc becomes a test: Gram crit chance 69%, weak-point 9.375x / 5.25x, Acuity on Butcher 8.25x, Bane double-dip 1.69x / 2.4025x, Blast proc and radial formulas, the quantization example, the elemental combiner table.
2. **Property tests.** The Monte Carlo mean must converge to the expected-value result; damage must never go negative; adding a positive-only module never lowers expected damage (except known traps like Acuity disabling multishot).
3. **Golden tests from the user's in-game runs.** Each report is stored as a fixture `{build, enemy, scenario, observed}` and replayed on every commit. A mismatch is a regression or a newly discovered mechanic.

### How to request a test (template for the implementing agent)

> **Test T-n: question it answers.** Simulacrum, enemy _X_ at level _Z_ (Steel Path off), weapon _W_ rank 30, mods _A, B, C_ at max rank, no arcanes, no companion, no abilities. Shoot the _body / head_, _single shots_. Report: the arsenal values for damage per type, crit chance, crit multiplier, status chance; then 5 observed damage numbers per colour (white / yellow / orange), and any proc tick numbers.

Rules for the requester: change one variable per test; prefer unarmored, unshielded targets and damage types the target's faction is neutral to; screenshot the arsenal stat screen; turn on the damage-number options that stop clustering (added Update 42 ([patch notes](https://www.warframe.com/en/patch-notes/android/42-0-0))).

### Starter test list (each resolves a \[T\] in this doc)

| ID   | Question                              | Sketch                                                                                           |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| T-1  | Baseline and display rounding         | Unmodded simple rifle, body shots on a neutral unarmored target                                  |
| T-2  | Quantization edge case                | A weapon with a tiny IPS share; compare arsenal values with and without Serration and an IPS mod |
| T-3  | Elemental order and innate elements   | Same three elemental mods in 3 slot orders on a weapon with an innate element                    |
| T-4  | Crit tiers and headcrit               | Reach \~150% CC; record yellow and orange numbers on body, then on a head with the headcrit flag |
| T-5  | Cold crit bonus: absolute or relative | Vital Sense build; compare crits at 0 and 1 Cold stack                                           |
| T-6  | Armor cap vs strips order             | High-level Grineer above 2,700 scaled armor; compare damage at 0 and 10 Corrosive stacks         |
| T-7  | Shield overflow into health           | One large hit on a shielded Corpus unit just above its shield value                              |
| T-8  | Bleed vs faction weakness             | Slash proc ticks on Infested vs a neutral faction with equal health                              |
| T-9  | Tau vulnerability stacking            | Status chance observed with and without Tau stacks (needs a Tau source)                          |
| T-10 | Bow fire-rate rule                    | Bow charge time with and without a fire-rate mod                                                 |
| T-11 | GunCO on a projectile weapon          | Galvanized Aptitude stacks vs Serration on a non-hitscan rifle                                   |
| T-12 | Headshot-multiplier bonus bucket      | Deadhead or similar plus Acuity on the same head                                                 |
| T-13 | Heat inherit                          | First Heat proc from an ability, then from a modded weapon; record tick values                   |
| T-14 | Zeroed types and proc weights         | Weapon from T-2: can a type quantized to 0 still proc?                                           |

Use the user's offer sparingly: batch 3–4 tests per request, and only once the engine has the module the test exercises, so each report can be replayed immediately.

## 17. Open questions and roadmap

### Known unknowns

Each item is either a test (section 16) or a source check. None blocks starting; all block calling the engine "accurate".

- [ ] Quantization: can a type quantized to 0 still be chosen as a proc? Do proc weights use quantized or raw values? (T-2, T-14)
- [ ] Armor: does the 2,700 cap apply before or after strips? Exact order of mixed strip kinds. (T-6)
- [ ] Layers: does overflow from a broken shield or Overguard carry into health in the same instance? Which modifiers apply to Overguard? (T-7)
- [ ] Crit: Cold's +0.1x absolute or relative; headcrit doubling base or modded CD; which weapons have multiplicative weak-point crit. (T-4, T-5)
- [ ] Status: Tau vulnerability formula; Bleed and faction weakness; Gas proc's elemental scaling; tick counts for immediate-tick procs. (T-8, T-9)
- [ ] Fire rate: is the bow double-benefit rule still live? Auto-spool start rates. (T-10)
- [ ] GunCO mode per weapon. (T-11)
- [ ] Health-scaling coefficients garbled in extraction; read them from the page source.
- [ ] Banshee was reworked in Update 44; re-check Sonar's weak-point behaviour before modelling it.
- [ ] The wiki's Damage page lists an Update 43.0 (2026-06-17) armor-related patch entry that couldn't be read; check it.
- [ ] Eclipse and Roar current values, including subsumed versions.
- [ ] Licensing: wiki text is CC BY-SA; confirm terms for bundling Public Export and WFCD data before shipping a library.

The wiki itself flags Damage/Calculation as incomplete and self-contradictory, so expect the in-game tests to overturn a few items here; that is what the golden-test fixtures are for.

### Roadmap

&#91;embedded content: engine roadmap · 4 phases, each gated by tests\]

Each phase ends when its gate's tests pass; the in-game tests listed at each gate are the batch to request from the user at that point. The engine API (Scenario in, metrics and trace out) is stable after phase 1, so UI design can start in parallel then.

## Sources

Main pages opened for this research (section-specific links are inline):

- [Damage/Calculation](https://wiki.warframe.com/w/Damage/Calculation) · [Armor](https://wiki.warframe.com/w/Armor) · [Enemy Level Scaling](https://wiki.warframe.com/w/Enemy_Level_Scaling) · [The Steel Path](https://wiki.warframe.com/w/The_Steel_Path)
- [Blast Damage](https://wiki.warframe.com/Damage/Blast_Damage) · [Tau Damage](https://wiki.warframe.com/w/Damage/Tau_Damage) · [Extra Hit](https://wiki.warframe.com/w/Extra_Hit) · [Buff](https://wiki.warframe.com/w/Buff) · [Fire Rate](https://wiki.warframe.com/w/Fire_Rate?oldid=2816297)
- [Fandom Damage](https://warframe.fandom.com/wiki/Damage) · [Fandom Critical Hit](https://warframe.fandom.com/wiki/Critical_Hit) · [Fandom Status Effect](https://warframe.fandom.com/wiki/Status_Effect) (stale; used only where noted)
- [warframe-damage.com](https://warframe-damage.com/) · [Dexerto faction table](https://dexerto.com/gaming/warframe-every-damage-type-explained-3016992)
- Patch notes: [Update 44](https://www.warframe.com/en/patch-notes/pc/44-0-0), [Hotfix 44.1.3](https://www.warframe.com/patch-notes/pc/44-1-3), [Update 36](https://www.warframe.com/en/patch-notes/pc/36-0-0)

Several wiki pages (Damage, Status Effect, Critical Hit, Damage over Time, Enemy Body Parts) refused direct fetches during research; their content here comes from search excerpts of those pages, so re-read them in full before implementing.
