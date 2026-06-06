# Research: File size, SRP-driven splitting, and when small files hurt (2026)

Research agent: **T-filesize** | Date: 2026-06-04 | READ-ONLY on the codebase.

Scope: max file length consensus, SRP at file level, when aggressive splitting hurts (locality of behavior / Carmack / HTMX), and the AI-era angle (files as context units). All recommendations are grounded in the actual `diffgazer` monorepo.

---

## TL;DR consensus (2025/2026)

- There is **no objective max file length**, but the de-facto industry anchor is the **ESLint `max-lines` default of 300 lines**, with the commonly cited *acceptable range of 100–500 lines per file*. This is a code-smell heuristic, not a hard law.
- **SRP at the file level is about "reasons to change," not line count.** "One main export per file" (one component, one hook) is broad consensus. A main export **plus small private helpers used only by it** is *preferred over splitting the helpers out* — colocation wins until the helper is genuinely reused.
- **Aggressive splitting hurts** when it fragments one cohesive idea across many files (frame-switching cost, "jump-around reading," premature abstraction, orphaned utilities). Locality of Behaviour (HTMX/Carson Gross), Carmack's inlining argument, and Kent C. Dodds' colocation all push back on reflexive extraction.
- **AI-era nuance:** guidance has converged on **cohesive, single-responsibility, feature-colocated files that are individually small-to-medium** — NOT extreme micro-files and NOT giant monoliths. The reason is signal-to-noise: agents want to pull one self-contained slice without cross-cutting jumps, and without dragging in 90% irrelevant tokens. Filenames + folder structure are themselves high-signal context for agents.

---

## Q1 — Evidence/consensus on max file length for TS/React

### ESLint `max-lines` (the primary linter anchor)
Source: https://eslint.org/docs/latest/rules/max-lines

- **Default `max` = 300 lines.** Options: `max` (default 300), `skipBlankLines`, `skipComments`.
- Not in the `recommended` config (you opt in).
- Rule rationale, quoted: *"Some people consider large files a code smell. Large files tend to do a lot of things and can make it hard following what's going [on]."* It explicitly states there is **no objective maximum**, and *"Recommendations usually range from 100 to 500 lines."*

### `max-len` (line length, separate concern)
Source: https://eslint.org/docs/latest/rules/max-len ; https://www.codalas.com/en/2303/the-recommended-max-len-value-in-javascript-and-eslint

- ESLint default `max-len` = **80 chars**; modern teams commonly raise to **100 or 120** (Prettier's default print width is 80; many TS teams use 100–120). This is line *width*, distinct from file *length*, but frequently conflated by tooling configs.

### `max-lines-per-function` and SonarQube S138 (function length, related)
Sources: https://eslint.org/docs/latest/rules/max-lines-per-function ; https://github.com/SonarSource/sonar-dotnet/issues/1013 ; community.sonarsource.com threads

- ESLint `max-lines-per-function` default = **50 lines**.
- SonarQube **Rule S138** ("Functions should not have too many lines of code") exists for JS/TS, configurable, commonly defaulted around the same magnitude.
- Important: function-length limits are **in tension** with the locality/inlining argument in Q3. Carmack explicitly rejects the "page or two" function rule.

### Verdict on Q1
Consensus is a **soft heuristic, not a rule**: ~300 lines is the most-cited file ceiling (because it is the ESLint default everyone inherits), the broader tolerated band is 100–500, and "thousands of lines in one hand-written logic file" is universally a smell. Style guides decline to mandate a hard number — React's official docs and Wieruch give *no* line thresholds at all and instead use behavioral criteria (see Q2/Q3).

---

## Q2 — SRP at file level: one component/hook per file; main export + private helpers

### One component per file
Source (Airbnb React/JSX Style Guide): https://github.com/airbnb/javascript/blob/master/react/README.md and issue https://github.com/airbnb/javascript/issues/2254

- Airbnb: *"Only include one React component per file. However, multiple Stateless, or Pure, Components are allowed per file."* (rule `react/no-multi-comp`).
- Nuance: Airbnb **disabled the `react/no-multi-comp` ESLint enforcement back in 2019** while keeping it as written guidance. So even the canonical "one component per file" source treats it as a *guideline with an explicit exception for small pure helper components colocated with their parent* — not a hard split-everything rule.

### One hook per file? — behavioral, not mechanical
Source (Robin Wieruch, "React Folder Structure Best Practices [2026]"): https://www.robinwieruch.de/react-folder-structure/

- Wieruch: *"whenever a React component becomes a reusable React component, I split it out as a standalone file."* Extraction is triggered by **reuse**, not by line count.
- On hooks specifically: *"React Hooks which are still only used by one component should remain in the component's file or a hooks.js file next to the component."* Only shared hooks get promoted to a top-level folder.
- Early on, *"it's acceptable to have multiple components in one file"* if closely related; split once the file *"will eventually become insufficient."*

### Main export + small private helpers — colocation wins
Source (Kent C. Dodds, "Colocation"): https://kentcdodds.com/blog/colocation

- Core principle, quoted: **"Place code as close to where it's relevant as possible."** (Dan Abramov framing: *things that change together should be located as close to one another as reasonable*.)
- Maintainability case: separated code drifts **out of sync**, hurts **discoverability**, and adds **context-switching cost**.
- Explicit warning against premature extraction into shared "utility" dirs: a helper hoisted to a `utils/` folder becomes *"out of sight, out of mind"* when its only consumer is deleted → dead code. Keep helpers next to their single usage point until genuine multi-location reuse emerges.

### React official stance — no premature structure
Source: https://legacy.reactjs.org/docs/faq-structure.html

- *"If you're just starting a project, don't spend more than five minutes on choosing a file structure."*
- *"If you feel completely stuck, start by keeping all files in a single folder. Eventually it will grow large enough that you will want to separate some files from the rest."*
- *"Unless you have a very compelling reason to use a deep folder structure, consider limiting yourself to a maximum of three or four nested folders within a single project."*

### Verdict on Q2
Consensus: **one main public export per file** (one component, one hook) **+ its small private helpers colocated in the same file** is the recommended default. Split a helper/component/hook out **when, and only when, it becomes reused or the file crosses the readability threshold (~the 300-line band)** — not preemptively. SRP is defined by "one reason to change," which a main export and its private helpers usually share.

---

## Q3 — When aggressive splitting HURTS

### Over-modularization as an anti-pattern
Sources: https://www.freecodecamp.org/news/antipatterns-to-avoid-in-code/ (Proliferation of Code) ; HN discussion https://news.ycombinator.com/item?id=28123854

- freeCodeCamp "Proliferation of Code" anti-pattern: objects/modules that exist *only as middlemen* add *"an unnecessary level of abstraction (adds something that you have to remember) and serves no purpose, other than to confuse people who need to understand the flow and execution of your codebase."*
- General principle echoed across sources: if logic is broken into too many tiny units, *"you'll have to jump around everywhere"* to view details *"that may be too small to be worth it"* → cognitive overhead with no benefit.

### Locality of Behaviour (HTMX / Carson Gross)
Source: https://htmx.org/essays/locality-of-behaviour/

- Definition, quoted: **"The behaviour of a unit of code should be as obvious as possible by looking only at that unit of code."** (Richard Gabriel: locality *"enables a programmer to understand that source by looking at only a small portion of it."*)
- LoB is **in tension with both DRY and Separation of Concerns.** Splitting behavior into distant files creates *"spooky action at a distance"* — changing a far-away file silently changes behavior here.
- Crucial caveat, quoted: *"There is no hard and fast rule, but rather subjective tradeoffs that must be made as software developers."* LoB is a guiding principle, not absolute; sometimes DRY/SoC correctly wins.

### John Carmack's inlining argument
Source: https://cbarrete.com/carmack.html (mirror of the 2007 number-none.com email)

- Directly rejects the function-length rule of thumb, quoted: *"I know there are some rules of thumb about not making functions larger than a page or two, but I specifically disagree with that now – if a lot of operations are supposed to happen in a sequential fashion, their code should follow sequentially."*
- *"The function that is least likely to cause a problem is one that doesn't exist, which is the benefit of inlining it."* Inlining also *"has the benefit of not making it possible to call the function from other places"* — preventing accidental reuse / spooky coupling.
- Practical rule he endorses: *"If a function is only called from a single place, consider inlining it."*
- He still values purity where practical: *"The value step from almost-pure to completely-pure is smaller than that from spaghetti-state to mostly-pure."* I.e., the win is from reducing shared mutable state, not from maximizing the *number* of files.

### How this is weighed today (2026)
- Modern synthesis (visible across the SRP/cohesion sources): SRP's real definition is **"gather together the things that change for the same reasons; separate those that change for different reasons"** — *cohesion*, not minimal file size. Over-splitting *decreases* the cohesion SRP is supposed to maximize.
- The "frame-switching" cognitive argument: a cohesive file/package stabilizes the mental model of a feature; a fragmented one *"forces reconstruction and search"* every time you read it. (DEV / SRP-and-working-memory discussions.)
- Carmack's view is treated as *context-dependent and correct for tightly-sequential, single-call-site code* (game loops, pipelines, control flow), and **not** as license to write 2000-line god-objects with many responsibilities. The repo's review pipeline / state machines are the closest analog where sequential cohesion matters.

### Verdict on Q3
Splitting hurts when it: (a) fragments one cohesive concept across files (frame-switching, jump-around reading), (b) creates middleman/pass-through modules, (c) hoists single-use helpers into shared dirs (orphan/dead-code risk), or (d) is done preemptively before reuse exists. The mature 2026 position: **extract on demonstrated reuse or a real readability cliff, not on a line counter.**

---

## Q4 — AI-era angle (2025/2026): files as context units

This is where the most *recent* and most *interesting* divergence lives.

### Pole A — "smaller, feature-colocated, single-responsibility files" (dominant, structured view)
Source: https://dev.to/somedood/coding-agents-as-a-first-class-consideration-in-project-structures-2a6b

- Argues project structure should be a **first-class consideration for coding agents**: **vertically-sliced, feature-driven** with **small focused files**.
- *"Modularized logic and collocated files improve recall by eliminating cross-cutting jumps between directories."*
- Warns against *"monolithic `Service`-like classes and `Repository`-like classes"* and against dumping inter-feature logic together (except orchestration).
- *"Self-contained modules encourage incremental features (rapid iteration!) and concurrent implementation (no merge conflicts!)."*
- *"Tightly scoped unit tests are more important than ever! Keep your LLMs honest with focused test suites"* — large test files pollute the context window.

### Pole B — "one big self-contained file" for AI (minority, phase-specific view)
Source: https://dev.to/embernoglow/modularity-an-overrated-anti-pattern-the-power-of-the-monolithic-script-in-the-age-of-ai-5oc (2025-02-21)

- For **solo prototyping with LLMs**, a single monolithic file gives *complete self-contained context* the model processes more reliably; LLMs *"forgot about side effects between files."* Uses `#region` markers for navigation instead of splitting.
- **Explicitly concedes** modularity remains essential for teams, long-term maintenance, production code, and clearly-componentized projects. The author frames it as **temporary/phase-specific** (monolithic for prototype, modular for release).

### The reconciling principle — signal-to-noise, not raw size
Sources: Anthropic "Effective context engineering for AI agents" https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents ; token-efficiency analyses (inventivehq, kiara.tech, mindstudio)

- Anthropic: context is *"a finite resource with diminishing marginal returns"*; models suffer **"context rot"** (recall degrades as token count grows). Goal: *"the smallest possible set of high-signal tokens."*
- Anthropic also notes structure itself is signal: *"Folder hierarchies, naming conventions, and timestamps all provide important signals that help both humans and agents understand how and when to utilize information."*
- Token analyses: *"A focused 50K context with high signal-to-noise will outperform a sprawling 500K context where 90% is irrelevant"*; large files trigger the **"lost in the middle"** problem. Tooling advice: prefer `@symbol` over `@file`; feed *the function + its class + directly imported modules* rather than a 1,000-line file. Anthropic's own Skills guidance: *"Keep SKILL.md under ~200 lines."*

### Verdict on Q4
The 2026 consensus is **NOT** "make every file tiny," and **NOT** "one giant file." It is: **cohesive, single-responsibility, feature-colocated files that are individually small-to-medium so an agent can load one self-contained slice at high signal-to-noise without cross-directory jumps.** A self-contained ~150–400-line module beats both a 50-line micro-file (forces jumps, low context) and a 2000-line god-file (lost-in-the-middle, drags irrelevant tokens). This **agrees with** the human-readability consensus from Q1–Q3 — the AI era sharpened the same advice rather than reversing it. Pole B (monoliths-for-AI) is real but narrow: solo prototyping only, and even its author retreats to modularity for production.

---

## Cross-source agreement vs disagreement

**Agreement (strong):**
- No hard numeric law; ~300-line ESLint default is the shared anchor; 100–500 tolerated.
- Colocate single-use helpers with their consumer; extract on reuse, not preemptively.
- Cohesion ("reasons to change") is the real SRP test, not line count.
- AI era reinforces single-responsibility, feature-colocated, small-to-medium files.

**Disagreement / live controversy:**
1. **Function/file length limits vs Carmack/LoB inlining.** ESLint `max-lines-per-function: 50` and the "page or two" rule directly contradict Carmack's "let sequential code run long in one place." Today both are accepted *in their domain*: limits for general business code; long cohesive functions for tightly-sequential pipelines/control flow.
2. **Barrel/`index.ts` files.** bulletproof-react now **discourages** them: *"In the past, it was recommended to use barrel files... However, it can cause issues for Vite to do tree shaking and can lead to performance issues. Therefore, it is recommended to import the files directly."* (https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md). This **conflicts** with the older "module = folder + index.ts public API" convention many style guides still teach. (Directly relevant to the owner's open question (a).)
3. **Monolith-for-AI (Pole B) vs modular-for-AI (Pole A).** Genuine disagreement, but largely resolved by *phase* (prototype vs production) and by the signal-to-noise reconciliation.

---

## What this means for diffgazer

Repo facts gathered (hand-written source, excluding generated/registry-mirror/tests): the largest hand-written logic files sit around **300–420 lines** — e.g. `cli/server/src/shared/lib/config/store.ts` (417), `cli/server/src/features/review/sessions.ts` (390), `cli/add/src/utils/transform.ts` (355), `apps/web/src/features/providers/hooks/use-model-dialog-keyboard.ts` (352), `libs/core/src/review/review-state.ts` (330), `libs/keys/src/hooks/use-action-row-navigation.ts` (304). The outlier `libs/core/src/catalog/catalog-snapshot.ts` (9242) is a **generated data snapshot**, not logic, so it should be exempt from any line rule. The repo already uses kebab-case + `use-x.ts` + `.test.ts` and feature folders (`features/review`, `features/providers`).

1. **Adopt `max-lines: 300` as a WARNING, not error, repo-wide; exempt generated/data files.** The hand-written code already clusters under ~420; the band 100–500 is the documented tolerance. Add overrides so `libs/core/src/catalog/catalog-snapshot.ts`, `**/generated/**`, `libs/ui/public/r/**`, `libs/keys/public/r/**`, and `**/registry/component-docs/**` (data/doc tables like `menu.ts` 322, `select.ts` 304) are NOT flagged — they are data, not logic, and splitting them would hurt the handoff contract. Treat the ~300 line crossings (`store.ts`, `sessions.ts`, `transform.ts`) as **review prompts** to check cohesion, not mandatory splits.

2. **Codify "one main export + colocated private helpers" as the file rule (SRP by reason-to-change).** A UI primitive file (`libs/ui`) keeps its component + tiny private subcomponents/helpers together; promote to a separate file only when reused. This matches Airbnb's "one component, pure helpers allowed" and Kent C. Dodds' colocation, and it stops the audit from over-splitting `libs/ui` primitives into micro-files. Per AGENTS.md extraction rules, **extract to `libs/keys`/`libs/ui` on real reuse, not on file length** — these two rules reinforce each other.

3. **Do NOT split for splitting's sake in the review pipeline and state machines.** `cli/server/src/features/review/*` and `libs/core/src/review/review-state.ts` are exactly Carmack/LoB territory: sequential, single-call-site control flow where locality beats premature extraction. Keep cohesive even if a file runs 300–400 lines; prefer named sections/helpers in-file over scattering the pipeline across many files. This is the one place to actively resist an aggressive "small files everywhere" recommendation.

4. **Keep co-locating tests (`*.test.ts`) and single-use helpers next to source.** Aligns with colocation + the AI-agent recall argument (no cross-directory jumps). The existing `.test.ts` convention is correct and should stay (also answers the owner's naming question (c): `.test.ts` and `use-x.ts` are the dominant, recommended suffix conventions — keep them even though `use-x` technically has a "prefix-hyphen").

5. **Resolve the barrel-file question explicitly (owner question (a)).** bulletproof-react's 2026 guidance is to **avoid barrel `index.ts` re-exports inside apps** (Vite tree-shaking/perf). For `apps/web`, `apps/docs`, `apps/landing`, prefer **direct imports** and skip per-folder `index.ts`. **Exception:** library *package* entry points (`libs/ui`, `libs/keys`, `libs/core`, `libs/registry`) legitimately need a curated public-API barrel — that is the package's published contract, not an internal convenience barrel. So: "module = folder + index" is fine for **published library roots**, discouraged for **internal app folders**.

6. **For AI-agent ergonomics (this repo is literally an AI-review tool worked on by agents):** favor self-contained feature slices (`features/<name>/{components,hooks,api}`) so an agent loads one slice at high signal-to-noise. Avoid both micro-files (force cross-file jumps) and god-files (lost-in-the-middle). The current `apps/web/src/features/*` layout is already the recommended shape — preserve it. Keep `AGENTS.md`/`CLAUDE.md` and folder names as high-signal navigation aids (Anthropic: structure is signal).

7. **Function-length: do not impose a hard `max-lines-per-function`.** Given the keys/review state-machine code, a 50-line function cap would fight Carmack/LoB and force artificial extraction. If anything, use it as a high-threshold lint *warning* (e.g. 80–100) and allow inline exceptions for sequential pipeline code.

---

## Sources consulted (URLs)
- https://eslint.org/docs/latest/rules/max-lines
- https://eslint.org/docs/latest/rules/max-len
- https://eslint.org/docs/latest/rules/max-lines-per-function
- https://www.codalas.com/en/2303/the-recommended-max-len-value-in-javascript-and-eslint
- https://htmx.org/essays/locality-of-behaviour/
- https://cbarrete.com/carmack.html
- https://kentcdodds.com/blog/colocation
- https://www.robinwieruch.de/react-folder-structure/
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- https://github.com/airbnb/javascript/blob/master/react/README.md
- https://github.com/airbnb/javascript/issues/2254
- https://legacy.reactjs.org/docs/faq-structure.html
- https://www.freecodecamp.org/news/antipatterns-to-avoid-in-code/
- https://dev.to/somedood/coding-agents-as-a-first-class-consideration-in-project-structures-2a6b
- https://dev.to/embernoglow/modularity-an-overrated-anti-pattern-the-power-of-the-monolithic-script-in-the-age-of-ai-5oc
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://inventivehq.com/blog/context-windows-explained-ai-coding
- https://kiara.tech/blog/stop-burning-cash-how-to-master-token-efficiency-with-ai-agents
- https://github.com/SonarSource/sonar-dotnet/issues/1013
- https://news.ycombinator.com/item?id=28123854
