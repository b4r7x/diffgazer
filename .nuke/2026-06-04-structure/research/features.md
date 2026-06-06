# Research: Feature-based vs layer-based folders, vertical slices, screaming architecture (2026)

Research agent: T-features. Date: 2026-06-04.
Scope: feature/vertical vs layer/horizontal organization for React apps AND Node services, "screaming architecture" in TS, sizing heuristics, and how feature folders coexist with monorepo package extraction. All applied to the diffgazer monorepo.

---

## Repo context (read-only inspection, ground truth before recommending)

The repo ALREADY adopts feature/vertical organization in three of its workspaces and a hybrid in a fourth:

- `apps/web/src` — bulletproof-react layout almost verbatim: `app/{providers,routes}`, `features/{review,history,providers,settings,home,onboarding}`, plus shared `components/{ui,layout,shared}`, `hooks`, `lib`, `utils`, `config`, `types`, `testing`, `styles`. Inside `features/review`: `components/` (with colocated `*.test.tsx`), `hooks/` (with colocated `*.test.tsx` and an `index.ts`), and a feature-root `index.ts`. So the feature is internally type-sub-foldered (components/hooks), tests are colocated next to source, and there is a feature-level barrel.
- `cli/server/src` — vertical slices: `features/{review,config,settings,shutdown,health}` each owning `router.ts`, `service.ts`, `schemas.ts`, plus a `shared/` layer (`middlewares/`, `lib/`, `lib/config/`). `features/review` is large (~40 files: pipeline, diff, context, sessions, sse-replay, drilldown, summary, file-tree, etc.) — a clear "fat slice" worth watching.
- `cli/diffgazer/src` — `app/`, `features/`, `components/`, `hooks/`, `lib/`, `theme/`, `config/`, `types/` (bulletproof-react shape adapted for an Ink TUI binary).
- `cli/add/src` — command-oriented (NOT generic layers): `commands/{init,add,diff,remove,list}.ts` + a nested `commands/add/{file-ops,manifest,css-ops}.ts` sub-slice, plus `utils/` (transform, registry, paths, hashing, detect, namespaces, integration) and a root `context.ts`/`index.ts`. This is the CLI form of screaming architecture (folder structure mirrors the verbs the tool exposes).

File naming observed: kebab-case, mostly single concept (`issue-list-pane`, `review-metrics-footer`, `use-severity-filter`), tests colocated as `*.test.ts(x)`, hooks as `use-x.ts`. This is the convention the owner is questioning (single-hyphen rule vs `.test.ts`/`use-x.ts` suffixes) — see "what this means for diffgazer".

Conclusion: the question is NOT "should diffgazer adopt feature folders" (it already has). It is "is the current adoption correct per 2026 consensus, and where are the failure modes."

---

## Q1. Current consensus: feature/vertical vs layer/horizontal — React AND Node. When is each right? Hybrids.

### Consensus (strong, multi-source)
The 2025/2026 consensus across React and Node sources is the same: **organize by feature/domain (vertical), not by technical type (horizontal), for anything past a trivial app.** Type-based folders (`components/`, `hooks/`, `services/`, `controllers/`) are endorsed only for very small / early-stage projects, and most authors call them a trap that calcifies.

- **bulletproof-react** (the owner's reference): "for easy scalability and maintenance, organize most of the code within the features folder." Top-level `src/` keeps `app/`, `components/` (shared), `hooks/`, `lib/`, `stores/`, `config/`, `types/`, `utils/`, `testing/` as the SHARED layer; everything feature-specific goes under `features/<feature>/{api,assets,components,hooks,stores,types,utils}` and "you don't need all of these folders for every feature. Only include the ones that are necessary." Source: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- **Robin Wieruch, "React Folder Structure Best Practices [2026]"** gives the explicit progression: single file -> multiple files -> component-in-folder (component.js + test + style + index) -> technical folders (`components/ hooks/ context/ utils/`) -> **feature folders** -> domain folders -> packages -> monorepo. The trigger to leave technical folders is qualitative: "There will be too many components in your components/ folder ... eventually." Source: https://www.robinwieruch.de/react-folder-structure/
- **TkDodo, "The Vertical Codebase"** is the sharpest statement of the principle. He dislikes `components / hooks / types / utils` because it "groups by type, not by domain," with the canonical absurdity that `useTheme` lives next to `useTodo` but far from `ThemeProvider`. Horizontal is "convenient when you're starting out, but that's about it." He cites Sentry's 200+ files in one `components/` dir whose only commonality is "that they are components. Nothing else." The vertical alternative: "Everything widget related code goes into src/widgets/. That can be components, hooks, types, utils, constants, whatever." Source: https://tkdodo.eu/blog/the-vertical-codebase
- **Kent C. Dodds, "Colocation"** supplies the underlying law: "Place code as close to where it's relevant as possible," and (crediting Dan Abramov) "Things that change together should be located as close as reasonable." Reasoning: separated resources "get out of sync or out of date quicker," readers "miss an important comment," and "context switching from one location to the next would be a challenge." Source: https://kentcdodds.com/blog/colocation
- **Node/backend side is identical.** "You're slicing your architecture wrong!" argues MVC is a fine *mental model* but a bad *directory layout*: "Does MVC supposedly being the correct mental model necessarily mean we should structure our directories as such?" Horizontal forces "jump between multiple directories—models/feature/*, controllers/feature/*, and views/feature/*"; vertical means "each feature module must encapsulate only its own end-to-end logic and nothing else." Source: https://dev.to/somedood/youre-slicing-your-architecture-wrong-4ob9
- The Node "modular vs layered" sources converge on a size rule: "If your app is small and simple, use Layered Architecture. If your app is medium to large, use Modular [feature-based] Architecture." Sources: https://medium.com/@branimir.ilic93/express-js-best-practices-modular-vs-layered-approach... and https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl

### When each is right
- **Layer/type folders right when:** the whole app is small (Wieruch's "small or medium apps"; Node sources' "small and simple"; FSD reviewers' "few simple pages"), or for a thin shared-primitives package where the "domain" IS "ui primitives" (a library legitimately groups by component).
- **Feature/vertical right when:** multiple features, multiple contributors/teams, or the app is "growing rapidly." This is the default recommendation for "any real application" (Sandro Roth: type-based "works fine for very small projects ... For any real application I don't recommend it." https://sandroroth.com/blog/project-structure/).

### Hybrid (the actual real-world answer, and what diffgazer does)
The dominant production pattern is **vertical at the top, horizontal inside**: a `features/` (or domain) tree where each slice may still have a small `components/ hooks/ utils/` inside it, PLUS a shared horizontal layer (`components/ui`, `lib`, `utils`, `hooks`) for cross-feature code. bulletproof-react is itself this hybrid. The rule for the shared/feature boundary (from the search synthesis and bulletproof-react): "if exactly one feature uses a util, it lives inside that feature; once two or more features need it, it moves up to the shared layer. The same logic applies to hooks, context, and components." This is exactly diffgazer's `apps/web` (features + `components/{ui,shared}`) and `cli/server` (features + `shared/`).

---

## Q2. "Screaming architecture" (Uncle Bob) applied to TS — real adoption vs hype.

### What it is
Uncle Bob (2011): the top-level structure should "scream" the use cases / business domain, not the framework. "The architecture of a software application should scream about the use cases of the application, just as the plans for a house ... scream about the use cases of those buildings." Source: https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html

### Adoption vs hype in TS (honest read)
- **The naming/folder idea is genuinely adopted and is now mainstream consensus** — but it has largely been *absorbed into* "feature folders / vertical slices" rather than adopted under the Uncle Bob brand. When bulletproof-react/Wieruch/TkDodo say "organize by domain so you can see what the app does," that IS screaming architecture; they rarely cite the term. The profy.dev synthesis explicitly links them: feature-based design "aligns with Screaming Architecture for long-term maintainability."
- **The branded full Clean Architecture (layers, ports/adapters, interface gymnastics) is contested / often called overkill in TS.** Milan Jovanović (a strong proponent) presents screaming architecture as fully compatible and "complementary" with vertical slices and bounded contexts, with feature folders like `Apartments/ReserveApartment`, `Bookings/CancelBooking`, and notes "vertical slices result in a less nested folder structure" than full Clean layers. Source: https://www.milanjovanovic.tech/blog/screaming-architecture. But the critique side (Mews "Clean Architecture vs pragmatic architecture"; HN "A Critique of Clean Architecture"; HN "Software Architecture Is Overrated, Clear and Simple Design Is Underrated") argues the heavy layering/interface ceremony is demanding and that colleagues "forget to add interfaces or work around framework annotations." Sources: https://developers.mews.com/clean-architecture-vs-pragmatic-architecture/ , https://news.ycombinator.com/item?id=16058979 , https://news.ycombinator.com/item?id=21001676

### Net for TS
The *screaming folder convention* (top-level names = domain/use-cases) = real, widely adopted, low cost, high payoff. The *full Clean Architecture apparatus* = hype/overkill for most TS apps and CLIs; adopt the screaming part, skip the dogmatic layering unless a genuine port/adapter need exists.

### Crucial CLI corollary (directly applies to cli/add and cli/diffgazer)
For CLIs, screaming architecture has a concrete, framework-blessed form: oclif's convention is that "the folder structure emulates the CLI" — top-level commands live in their own directories, folder == command, `index.ts` is its entry. Source: https://oclif.io/docs/templates/ and https://www.joshcanhelp.com/oclif/ . diffgazer's `cli/add/src/commands/{add,remove,list,diff,init}` already screams "this is an add/remove/list/diff/init CLI" — that is the correct CLI shape, not generic `services/`+`utils/`.

---

## Q3. At what app size does feature structure pay off vs add ceremony? Evidence/heuristics.

There is no universally agreed numeric threshold — and the most credible authors (Wieruch, TkDodo) deliberately refuse to give one, saying it evolves. But triangulating the sources yields usable heuristics rather than vibes:

- **Wieruch's heuristics are behavioral, not numeric:** extract a hook to shared when "more than one component" uses it; leave technical folders when there are "too many components in your components/ folder ... eventually"; cluster features into domains "once your features/ folder grows past a handful of entries." No LOC/team thresholds — explicitly "structure evolves naturally." (https://www.robinwieruch.de/react-folder-structure/)
- **The flat-until-~15 heuristic:** multiple React structure articles cite a flat folder being fine "particularly when fewer than 15 components are present" — past that, group. (search synthesis incl. NamasteDev, profy.dev)
- **Node rule of thumb:** "small and simple -> layered; medium to large -> modular/feature." (https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl)
- **FSD / heavy methodologies pay off only at scale:** FSD "feels heavy-handed and slow in smaller applications" and "truly shines when an application begins to scale beyond a few simple pages or components ... rapidly growing or when multiple teams are collaborating." For small side-projects, "a simpler structure like Bulletproof React works perfectly." Sources: https://dev.to/arjunsanthosh/mastering-feature-sliced-design-lessons-from-real-projects-2ida , https://dev.to/algoorgoal/feature-sliced-design-review-22k0
- **Premature-abstraction cost (the ceremony side):** "In very small applications, the initial overhead might not be justified." "Avoid premature abstraction and let duplication surface naturally before extracting shared components ... never create a Common folder without clear ownership and purpose." A 2025 study cited in the search synthesis claims premature abstractions made code "40% harder to review and increase[d] bug introduction rates by 25%" (treat the exact numbers as soft — single secondary source, unverified primary). Source: https://medium.com/@vinodjagwani/clean-architecture-is-not-about-folders-feature-based-design-works-better-d349e920dcf1 and https://www.ai-infra-link.com/how-early-custom-abstractions-hurt-platform-teams-and-what-to-do-instead/

### Synthesized heuristic for diffgazer
Feature folders pay off once a unit has (a) more than ~2-3 distinct domain areas, or (b) more than one contributor, or (c) is "growing." All diffgazer workspaces except possibly tiny ones clear this bar. The *ceremony* risk is not "having features" — it's two sub-failures: (1) creating empty/near-empty `api/ hooks/ stores/ utils/` sub-folders inside a tiny feature when bulletproof-react explicitly says include only what's necessary, and (2) a *single* fat slice (diffgazer's `cli/server/src/features/review`, ~40 files) that has silently become a horizontal codebase again inside one folder.

---

## Q4. How do feature folders interact with a monorepo that extracts shared code into packages? What stays app-local?

### Consensus mechanics
- **The unidirectional dependency rule is the load-bearing constraint, and it maps cleanly onto packages.** bulletproof-react: code flows **shared -> features -> app**; "It might not be a good idea to import across features. Instead, compose different features at the application level"; enforce with ESLint import boundaries. In a monorepo, "shared" becomes published/internal packages and "features" stay in the app. Source: https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- **TkDodo's monorepo answer for shared code:** "the solution is usually to make them their own vertical" / a `/design-system` vertical with "clear scope: Reusable assets, components and patterns," and to "use monorepo package exports to define [the] public interface," with `eslint-plugin-boundaries` to enforce who can depend on what and to ban deep imports into a package's internals. Source: https://tkdodo.eu/blog/the-vertical-codebase
- **Extraction timing — avoid premature extraction.** "When code is duplicated across apps, extract it into packages/ui or packages/shared and replace duplicates with workspace:* dependencies." But the recommended approach is "start by adopting structure in the most active app, add import rules to prevent forbidden dependencies, and expand to other apps as they change" — i.e., extract on the rule of two (second consumer), not speculatively. The biggest wins "come from architecture [clear boundaries, explicit public APIs, strict dependency hygiene]," not from the tooling. Sources: search synthesis on Turborepo; https://feature-sliced.design/blog/frontend-monorepo-explained

### What stays app-local vs goes to a package
- **App-local (stays in `features/`):** product-specific composition, copy/wording, domain flows, data fetching wiring, app-only layout, route/page glue. This matches diffgazer's AGENTS.md verbatim ("apps/web owns product-specific composition, copy, domain flows, data fetching, and app-only layout decisions. Extract from web only when behavior is generic and reusable outside Diffgazer"). So bulletproof-react's "app vs features vs shared" three-tier collapses, in diffgazer, to: `features/` and app `components/{layout,shared}` = app-local; the "shared" tier is the *packages* (`libs/ui`, `libs/keys`, `libs/core`, `libs/registry`).
- **Package (the "shared" tier):** generic, reusable-outside-the-app primitives. diffgazer's boundaries already encode the exact extraction discipline the literature recommends: extract a *named real concept* with a *public contract*, not "two files look similar." That is stricter and better than the generic blog advice.

### Important nuance: packages can themselves be vertical or horizontal
A *primitives* package (`libs/ui`, `libs/keys`) legitimately groups by component/utility (its "domain" is the primitive itself) — horizontal-inside-the-package is correct there. A *business-logic* package (`libs/core`) should group by concept (schemas, result types, hooks, state machines) — diffgazer does this. Don't force `features/` onto a primitives library.

---

## Where sources DISAGREE (controversies)

1. **Barrel / `index.ts` per feature.** bulletproof-react now DISCOURAGES barrels: "it can cause issues for Vite to do tree shaking and can lead to performance issues ... import the files directly." Wieruch is pragmatic: barrels are "getting out of fashion ... because they make tree shaking harder," BUT "if you don't just re-export everything ... but only the public API, then it can be a good practice, because you don't leak implementation details." Sandro Roth still endorses a feature `index.ts` "that acts as a public API." => Disagreement on barrels-for-public-API. The reconciling position: a thin curated feature-root `index.ts` exporting only the public surface is fine and aids boundary enforcement; deep "re-export everything" barrels (and per-folder index inside the feature) are the harmful kind. diffgazer has feature-root `index.ts` (good) AND `hooks/index.ts` inside review (the watch-it kind).

2. **One folder per component (component + test + style + index).** Wieruch and Kent C. Dodds (colocation) favor co-locating a component's files. But Sandro Roth criticizes bulletproof-react for "tightly coupled components/hooks forced into separate folders," and the tests-colocation sources split: colocation aids discoverability/maintainability for unit tests, while a `__tests__`/separate dir "ensures your application code is clean" and is preferred by some at scale. Consensus tilt: **colocate unit tests with source; keep e2e/integration separate** ("create a testing directory for tricky tests like integration or e2e, and colocate your unit tests"). Per-component *folders* are optional polish, only worth it when a component has 3+ sibling files. Sources: https://kentcdodds.com/blog/colocation , https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8 , https://www.yockyard.com/post/co-locate-unit-tests/

3. **bulletproof-react's app<->feature dependency ambiguity.** Sandro Roth and the FSD camp criticize bulletproof-react: "global files access feature modules and feature modules access global files ... no guidelines ... may get messy." FSD fixes this with strict layer ranks, at the cost of "more complex to understand and apply." => Disagreement on how strict to be. For diffgazer, AGENTS.md already imposes stricter boundaries than vanilla bulletproof-react (explicit ownership per workspace, `libs/core` must not import `apps/*`/`cli/*`), so it lands on the stricter, healthier side without paying full FSD ceremony.

4. **Screaming/Clean Architecture: essential vs overrated.** Milan Jovanović: complementary, beneficial, no caveats given. Mews/HN critics: heavy layering is demanding and often net-negative; "clear and simple design is underrated." => The folder-naming half is uncontroversially good; the layering half is genuinely contested. Take the cheap half.

5. **Numeric size thresholds.** Some articles assert "<15 components -> flat," "small -> layered." The strongest authors (Wieruch, TkDodo) refuse numbers and insist it's judgment + refactor-when-it-hurts. => Treat numeric thresholds as rough priors, not rules.

---

## What this means for diffgazer (concrete, per-workspace)

1. **Keep the existing feature/vertical structure — it matches 2026 consensus and the owner's bulletproof-react preference.** No restructuring of `apps/web`, `cli/server`, `cli/diffgazer`, `cli/add` is warranted on architecture grounds. Don't migrate to FSD layer-ranks; the payoff doesn't justify the ceremony for this size, and AGENTS.md already enforces stricter-than-bulletproof boundaries.

2. **`cli/server/src/features/review` is the one real smell** (~40 files in a single slice). This slice has quietly become a horizontal codebase inside one folder (pipeline, diff, context, sessions, drilldown, summary, file-tree, sse-replay, step-events, ...). Per TkDodo ("logical groups are often coupled to routes or pages"), split it into sub-slices by use case — e.g. `review/{pipeline, context, sessions, stream, drilldown, summary}` — each owning its router-fragment + service + schema + tests. This is the highest-value structural change found.

3. **Barrel discipline (controversy #1).** Keep thin, curated feature-root `index.ts` files as the public API of each feature (aids the unidirectional/no-cross-feature rule). Audit/remove "re-export everything" barrels and per-subfolder index files (e.g. `features/review/hooks/index.ts`) unless they expose a deliberately small public surface — they hurt tree-shaking and leak internals for no boundary benefit.

4. **Enforce the unidirectional rule with tooling, don't just trust it (controversy #3).** Adopt `eslint-plugin-boundaries` (or `import/no-restricted-paths`) to encode: no cross-`features/*` imports (compose at `app/`), features may import `shared`/packages but not vice versa, and `libs/core` must not import `apps/*`/`cli/*`. AGENTS.md states these rules in prose; making them lint-enforced closes bulletproof-react's documented ambiguity gap.

5. **Sub-feature folders: include only what's necessary (Q3 ceremony).** Do not pre-create empty `api/ stores/ utils/ types/` inside small features. bulletproof-react: "only include the ones that are necessary." Audit small features (`home`, `onboarding`) for skeleton folders.

6. **Tests: keep colocating unit tests next to source (current practice is correct, controversy #2).** `*.test.ts(x)` beside the implementation is the consensus for unit tests; keep `apps/web/src/testing` for shared helpers and any integration/e2e harness. No change.

7. **CLI screaming structure is already right.** `cli/add/src/commands/{add,remove,list,diff,init}` mirrors the CLI surface (oclif convention). Keep growing it as command-named slices (the existing `commands/add/{file-ops,manifest,css-ops}` sub-slice is the correct pattern when one command gets fat). Don't flatten commands into a generic `services/`/`utils/` layer.

8. **Monorepo extraction: keep the rule-of-two, named-concept discipline (Q4).** Extract from `apps/web` into `libs/*` only when behavior is generic and reused, with a real public contract — exactly AGENTS.md's existing extraction rules. Don't force `features/` onto primitives packages (`libs/ui`/`libs/keys` group by primitive — that's correct). The "shared" tier of bulletproof-react == diffgazer's `libs/*`; everything product-specific stays app-local in `features/`.

9. **On the owner's open questions, this topic's evidence says:**
   - (a) Grouping a module into its own folder (component+test+index): RECOMMENDED for colocation of files that change together, but only worth a dedicated folder at ~3+ sibling files; colocated unit tests are consensus, per-component index barrels are the discouraged part.
   - (b) bulletproof-react style applies to CLI/TUI/server: YES in spirit (vertical slices / screaming) — and for CLIs there's an even more specific blessed convention (commands == folders, oclif). `cli/server` should be vertical slices (Milan Jovanović), `cli/diffgazer` TUI can mirror app shape, `cli/add` should stay command-screaming.
   - (c) The file-naming question (one-hyphen vs `.test.ts`/`use-x.ts`) is largely OUT of this topic's scope (a sibling agent owns naming), BUT note: colocated-test convention universally uses the `.test.ts(x)` suffix, and React hooks universally use the `use-` prefix — both are multi-token by necessity. A strict "at most one hyphen / single word" rule collides with these conventions; the structure literature implicitly treats `*.test.ts` and `use-*.ts` as standard suffixes, not violations. Flag for the naming agent.

---

## Sources consulted (URLs)
- https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- https://www.robinwieruch.de/react-folder-structure/
- https://tkdodo.eu/blog/the-vertical-codebase
- https://kentcdodds.com/blog/colocation
- https://dev.to/somedood/youre-slicing-your-architecture-wrong-4ob9
- https://www.milanjovanovic.tech/blog/screaming-architecture
- https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html
- https://sandroroth.com/blog/project-structure/
- https://dev.to/arjunsanthosh/mastering-feature-sliced-design-lessons-from-real-projects-2ida
- https://dev.to/algoorgoal/feature-sliced-design-review-22k0
- https://feature-sliced.design/blog/frontend-monorepo-explained
- https://medium.com/@vinodjagwani/clean-architecture-is-not-about-folders-feature-based-design-works-better-d349e920dcf1
- https://www.ai-infra-link.com/how-early-custom-abstractions-hurt-platform-teams-and-what-to-do-instead/
- https://developers.mews.com/clean-architecture-vs-pragmatic-architecture/
- https://news.ycombinator.com/item?id=16058979
- https://news.ycombinator.com/item?id=21001676
- https://dev.to/pramod_boda/recommended-folder-structure-for-nodets-2025-39jl
- https://medium.com/@branimir.ilic93/express-js-best-practices-modular-vs-layered-approach-for-medium-and-large-appsintroduction-626e61cc908d
- https://itsmariodias.medium.com/colocation-of-tests-a-cross-language-perspective-982e75c872d8
- https://www.yockyard.com/post/co-locate-unit-tests/
- https://oclif.io/docs/templates/
- https://www.joshcanhelp.com/oclif/
- https://profy.dev/article/react-folder-structure
