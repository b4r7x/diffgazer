Przejdź do treści
Historia czatu




Powiedziałeś(-aś):
Chcę zrobić taki flow jak ma claude code / opencode ale do review git unstaged (+ github actions ai reviewer na PRach). Chciałbym przemyśleć w jaki sposób zrobić to żeby było najbardziej odpowiednio. Co mam na myśli. Jak powinienem wywoływać calle jak opencode / claude code żeby robić dokladne review, robić listę tych issues, user żeby mógł przez nie przechodzić i w ogóle. Chcialbym wiedzieć jak zrobić to z API do llma (gemini). Czy powinienem też uzyc libki np ai sdk od vercel żeby mi zwracało jsony ladne? Jak to ogarnac. Zrob websearch a następnie podaj mi najlepsze rozwiązanie 
ChatGPT powiedział:

Thought for 37s
Pewnie — da się to zrobić “jak Claude Code / OpenCode”, tylko zawężone do review (unstaged lokalnie + bot na PR-ach). Najlepszy wzorzec to: agent + narzędzia (tools) + twardy JSON schema + kolejka issue’ów, po której user nawiguję. Poniżej masz gotowy, sprawdzony mental model i architekturę.

1) Docelowy UX: “review jako kolejka issue’ów” (lokalnie i na PR)
Lokalnie (unstaged)
Komenda typu:

ai-review → skanuje git diff (unstaged), buduje listę issue’ów

ai-review next → pokazuje następny problem (z kontekstem i diffem)

ai-review open <id> → pełny opis + proponowany patch

ai-review apply <id> → aplikuje patch (albo robi commit suggestion)

ai-review ignore <id> / snooze / mark-fixed

ai-review export → markdown do wklejenia w PR / ticket

To “przechodzenie po problemach” to klucz. Claude Code też opiera “agentowość” o pętlę: model → tool → wynik → model… zamiast jednego promptu. 

Na PR (GitHub Actions)
Workflow na pull_request (albo komentarz /ai-review), pobiera diff PR-a

LLM generuje:

summary zmian

listę issue’ów (line-level gdzie się da)

Bot publikuje:

albo PR review comments (inline na diffie) 

albo Check Run annotations (świetne do “lint-like” listy problemów, limit 50 na request) 

OpenCode ma identyczny pattern integracji: komenda w komentarzu (/opencode / /oc) uruchamia task w runnerze. 

2) Najważniejsza decyzja: zawsze wymuszaj structured output (JSON Schema)
Masz tu mega wygodną sytuację, bo Gemini API wspiera structured outputs zgodne z JSON Schema (to jest dokładnie to, czego potrzebujesz do “listy issue’ów”). 

Dodatkowo Gemini ma function calling, więc możesz zrobić czystą pętlę agentową (model prosi o diff pliku / kontekst / testy). 

Minimalny schema na “issues queue”
Przykład (koncepcyjnie):

{
  "type": "object",
  "required": ["summary", "issues"],
  "properties": {
    "summary": { "type": "string" },
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "severity", "title", "file", "rationale", "recommendation"],
        "properties": {
          "id": { "type": "string" },
          "severity": { "type": "string", "enum": ["blocker", "high", "medium", "low", "nit"] },
          "category": { "type": "string", "enum": ["correctness", "security", "performance", "api", "tests", "readability", "style"] },
          "title": { "type": "string" },
          "file": { "type": "string" },
          "line_start": { "type": "integer" },
          "line_end": { "type": "integer" },
          "diff_hunk": { "type": "string" },
          "rationale": { "type": "string" },
          "recommendation": { "type": "string" },
          "suggested_patch_unified_diff": { "type": "string" },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        }
      }
    }
  }
}
Dlaczego to działa dobrze w praktyce? Bo UI/TUI i GitHub bot nie “parsują tekstu”, tylko renderują obiekty. Zero zgadywania.

3) Czy użyć Vercel AI SDK? Tak — i to jest “najbardziej opencode’owe”
Tak, użyj AI SDK od Vercel, jeśli budujesz w Node/TS:

daje jednolity interfejs do providerów, a OpenCode (wg deep-dive) wykorzystuje AI SDK właśnie jako warstwę ujednolicającą różnych modeli/providerów 

ma gotowe generowanie structured data (Output.json(), helpery typu jsonSchema) 

AI SDK 6 mocno poszło w kierunku agentów i “tool calling + structured output + standard JSON schema”. 

Jeśli nie chcesz zależeć od AI SDK: możesz iść “na czysto” w Google GenAI SDK, ale wtedy sam sobie dorabiasz retry, walidację, streaming, itp.

Moja rekomendacja (najmniej bólu):

core logiki w TS

AI SDK jako warstwa LLM + walidacja JSON Schema

osobno adapter do GitHub API (Octokit)

4) Jak “wołać” LLM, żeby review było dokładne (i nie rozwalało kontekstu)
Najlepszy flow jest 3-etapowy:

Etap A — zbierz materiał (deterministycznie)
Lokalnie:

git status --porcelain

git diff --unified=0 (mniej szumu, łatwiej mapować linie)

lista plików + statystyki

(opcjonalnie) eslint, tests, typecheck jako osobne tool-e

PR:

pobierz diff PR-a (REST “diff” media type)

pobierz listę changed files + patch hunks

Etap B — “triage pass” (szybko, szeroko)
Prompt: “Masz tylko diffa i minimalny kontekst. Wygeneruj krótką listę potencjalnych problemów + pytania o brakujący kontekst.”
Wyjście: issues[] w JSON.

Etap C — “drill-down pass” (wolniej, głębiej, tylko tam gdzie warto)
Dla każdego issue (albo top N wg severity):

dograj kontekst: fragment pliku (np. ±80 linii), definicje typów, testy dot. modułu

dopiero wtedy poproś o finalny opis + patch

To jest dokładnie duch narzędzi agentowych: model nie dostaje całego repo “na raz”, tylko prosi toolami o to, co potrzebuje. 

5) Multi-agent “lenses” (mega jakość, mało tokenów)
Zamiast jednego review, rób 2–4 równoległe perspektywy i potem scal:

Correctness / edge cases

Security / secrets / auth / injection

Performance / scalability

API / readability / maintainability

Claude ma nawet plugin code-review oparty o wiele agentów równolegle (różne perspektywy). 

Ty możesz to zrobić prościej: 3 osobne wywołania Gemini z różnymi system promptami i na końcu “merge step” (też w schemacie JSON).

6) Publikacja na GitHub: komentarze vs check annotations
Masz dwie dobre ścieżki:

A) PR review comments (inline)
najbardziej “ludzkie”
– musisz mapować pozycje/linie w diffie (GitHub ma swoje zasady) 

B) Check Run annotations (Files changed + Checks UI)
świetne do listy issue’ów (jak linter)
– limit 50 na request, trzeba batchować 

W praktyce: daj oba:

high/blocker → inline PR review comments

reszta → annotations w checku + zbiorczy komentarz z linkami/ID

7) GitHub Actions: bezpieczeństwo (ważne, bo LLM key = sekret)
Unikaj wzorca: pull_request_target + checkout kodu z forka + sekrety → to klasyczny footgun (sekrety mogą wyciec). GitHub sam podkreśla, że pull_request_target ma specjalne ograniczenia/ryzyka, i społeczność/branża to regularnie wałkuje. 

Bezpieczniejszy start:

trigger pull_request (bez sekretów dla forków) albo

uruchamianie tylko dla repo-collaboratorów / internal PRów

ewentualnie “manual slash command” (/ai-review) od członka zespołu

8) “Najlepsze rozwiązanie” jako całość (proponowany stack)
Core (wspólne):

TS/Node package review-core

moduły:

git-provider (lokalnie) / github-provider (PR)

chunker (dzieli diff na pliki/hunki + dokleja minimalny kontekst)

review-engine (triage + drilldown + merge multi-lens)

issue-store (sqlite/json) + statusy (open/applied/ignored/fixed)

LLM layer:

Vercel AI SDK 6 + Gemini

wszędzie structured outputs (JSON Schema) 

CLI/TUI:

Ink / Blessed / Bubble Tea (cokolwiek lubisz)

ekran: lista issue’ów + podgląd diff + “apply patch”

GitHub Actions:

workflow: fetch diff → call review-engine → publish:

annotations (check run)

inline review comments dla top-severity 

Jeśli chcesz, mogę Ci w następnym kroku rozpisać konkretne “narzędzia” (tooling interface) jakie powinien mieć agent (np. getDiff(), getFileContext(path, start, end), runCommand(cmd), applyPatch(diff)), plus gotowy “system prompt” pod Gemini, który wymusza: brak lania wody, tylko issues queue i umożliwia nawigację jak w OpenCode/Claude Code.

Powiedziałeś(-aś):
Jesli chodzi o tą wersję lokalną to chcę robić cli. Musisz mi zwebsearchować i powiedziec też, jak to powinno być w kontekście tego co powinniśmy miec do "powrotu" (historia). Czy sesje, czy review, czy jedno i drugie, lub polaczone? Muszę też wiedzieć dokładnie jak zrobić cały flow tak to z ai sdk (będę używać wiecej providerow), czy pierwszy call ma robić coś w stylu robienia ogólnej struktury i opisuję projektu żeby mieć jakiś background itd jak to ma się zachowywać. Musisz zwebsearchować i wszystko przemyśleć jak to ma dzialac w cli. Chciałbym dorzucić też opcje review pojedynczych plików on demand
ChatGPT powiedział:

Thought for 29s
Jasne — zrobiłem websearch i ułożyłem to tak, żebyś miał CLI do review z nawigacją po issue’ach, historią/powrotem, multi-provider przez Vercel AI SDK, plus review pojedynczych plików on demand.

Poniżej jest propozycja, która jest bardzo “opencode/claude-code-owa” w zachowaniu, ale zoptymalizowana stricte pod review.

1) “Powrót / historia”: sesje vs review-run — rób oba, ale rozdziel
Największy błąd w takich narzędziach to wrzucić wszystko do jednego “czatu” i potem nie da się wrócić do konkretnego wyniku review. Narzędzia terminalowe idą w stronę lokalnej historii/sesji (opencode trzyma sesje i wiadomości lokalnie w katalogu danych) 
, a Claude Code ma wzorce typu /compact, /clear, “token management” w ramach sesji 
. Copilot CLI też działa sesyjnie i dodatkowo ma koncept “trusted folder” 
.

Proponowany model danych (najpraktyczniejszy)
Masz 3 poziomy:

Workspace (projekt)

identyfikacja: np. hash root folderu repo (jak opencode robi projectHash) 

tu trzymasz stabilną pamięć projektu (o tym niżej)

Session (rozmowa / interakcje usera w CLI)

służy do “kontynuacji” typu: “przejdźmy dalej”, “a teraz sprawdź tylko security”, “zrób to samo ale na innym modelu”

zawiera log zdarzeń: user input, tool calls, tool results (AI SDK wręcz sugeruje trzymanie tool call + tool result w historii) 

ReviewRun (konkretny przebieg review na konkretnym snapshotcie zmian)

to jest najważniejszy byt dla “powrotu”

identyfikator: reviewId = hash(diff + baseRef + config + rulesVersion)

przechowuje: diff snapshot, lista issues[], statusy (open/ignored/fixed/applied), opcjonalnie patche

Dlaczego tak?

Session jest do “rozmowy” i eksploracji.

ReviewRun jest do powtarzalności i nawigacji po issue’ach (kolejka), plus do “wróć do review sprzed 2 dni”.

To jest też odpowiedź na realne problemy narzędzi: użytkownicy narzekają, że sesje giną albo trudno je ogarnąć globalnie, jeśli są zbyt ściśle przypięte do CWD 
.

Gdzie to trzymać na dysku
Wzoruj się na opencode: globalny data dir + struktura per project/session/run (opencode ma domyślnie ~/.local/share/opencode i tam ma storage/message i storage/session/...) 
.

U Ciebie np.:

~/.local/share/yourtool/

projects/<projectId>/

project.json (metadane)

memory/ (stabilna pamięć projektu)

sessions/<sessionId>.jsonl

reviews/<reviewId>/

diff.patch

issues.json

state.json (statusy issue’ów + mapowanie)

artifacts/ (opcjonalne patche)

JSONL dla sesji to super wybór (łatwe dopisywanie, łatwy replay, łatwe indeksowanie) — Copilot CLI też jest opisywany jako trzymający stan w JSONL w katalogu użytkownika 
.

2) “Pamięć projektu”: tak, ale jako osobny, stabilny artefakt (nie czat)
W Claude Code mocno funkcjonuje idea “projektowego opisu” generowanego przez init (np. bootstrap CLAUDE.md) 
. To działa, bo model dostaje stały kontekst, zamiast próbować go odtwarzać z historii rozmowy.

Jak to zrobić w CLI (bez spamu tokenami)
Dodaj komendę:

ai-review init

skanuje repo “lekko”: package manager, frameworks, foldery, test setup, lint, CI

generuje PROJECT_AI.md (albo .ai-review/project.md) + .ai-review/rules.md

użytkownik może to edytować

Następnie każdy ReviewRun ładuje:

PROJECT_AI.md

rules (style, standardy, “czego nie czepiać się”, tolerancja na nity)

opcjonalnie “known debt list”

Aktualizacja:

ai-review refresh (regeneruje streszczenie, ale z poszanowaniem ręcznych sekcji)

albo “delta update” po większych zmianach (np. wykrycie zmian w package.json, tsconfig, Cargo.toml)

To jest lepsze niż “pierwszy call robi wielki background” przy każdym review. Background robisz raz i trzymasz jako artefakt.

3) Flow w CLI: jak to ma się zachowywać (konkretnie)
A) Default: review unstaged
ai-review

zbiera git diff (unstaged) + lista zmienionych plików

tworzy ReviewRun (snapshot diffa)

robi LLM “triage” → zwraca issues[] w JSON

zapisuje issues i odpala UI “kolejki”:

lista issue’ów + next / open <id> / apply <id> / ignore <id>

B) Review pojedynczych plików on demand
Dwie komendy, obie przydatne:

ai-review file path/to/file.ts

bierze diff tylko dla tego pliku (unstaged albo staged — zależnie od flag)

issues tylko z tego pliku

statusy issue’ów nadal zapisywane w ReviewRun

ai-review focus path/to/file.ts

w ramach istniejącego ReviewRun tworzy “subqueue” tylko dla file

przydatne w nawigacji (“daj mi tylko problemy z tego pliku”)

C) Re-run / porównania
ai-review rerun --provider=... --model=...

tworzy nowy ReviewRun na tym samym diff snapshot (żeby porównać modele)

ai-review resume <reviewId>

wracasz do kolejki ze statusami

4) Jak wołać LLM (multi-provider) — najlepszy pattern: 2-pass + drilldown na żądanie
To jest klucz do jakości i kosztu.

Pass 1: TRIAGE (szybko, szeroko, bez dorabiania kontekstu)
Input:

diff (tylko zmienione hunki)

PROJECT_AI.md (skrótowo)

rules
Output (JSON schema):

summary

issues[] (z severity + file + zakres linii + rationale + “need_more_context?: true/false”)

Tu wymuszasz structured output przez AI SDK “Generating Structured Data” 
.

Pass 2: DRILLDOWN (tylko na issue’ach ważnych / otwieranych przez usera)
Kiedy user robi open <id> albo apply <id>:

dogrywasz kontekst narzędziami:

readFileRange(path, start, end)

searchInRepo(query)

getTypeDefs(...) (opcjonalnie)

dopiero wtedy prosisz model o:

poprawiony opis

propozycję patcha (unified diff)

ewentualne test suggestions

To dokładnie agentowy styl: model ma tools i działa krokami (AI SDK ma to natywnie) 
.

Efekt UX: szybka lista problemów, a głębia tylko tam, gdzie user klika.

5) “Jak to zrobić w AI SDK” (i żeby działało z wieloma providerami)
A) Warstwa model/provider routing
AI SDK daje Ci jeden interfejs do różnych providerów, a do structured output masz output/schema helpery (np. jsonSchema) 
.

Zrób u siebie prosty router:

--provider openai|anthropic|google|...

--model ...

fallback chain (opcjonalnie)

I pamiętaj o strict mode per tool (AI SDK 6 zmieniło podejście; strict opt-in per tool) 
.
To ważne, bo inaczej różni providerzy różnie “udają JSON”.

B) Structured output wszędzie, gdzie się da
TRIAGE: zawsze schema

ISSUE DRILLDOWN: też schema (żeby patch, confidence, kategorie były stabilne)

AI SDK przypomina, że “structured output” to też krok w agent loop i trzeba to uwzględnić w limitach kroków (stopWhen/step count) 
.

C) Tools: minimalny zestaw do review
W CLI potrzebujesz mało narzędzi, ale muszą być “czyste” i deterministyczne:

getDiff({scope: "unstaged"|"staged"|"file", path?})

readFile({path}) / readFileRange

repoSearch({query, glob?})

runCommand({cmd, cwd}) (opcjonalnie: test/lint)

applyPatch({unifiedDiff}) (opcjonalnie)

W AI SDK narzędzia to “tool calling”, schema wejścia i wynik idą do historii 
.

D) Historia w AI SDK vs Twoja historia
AI SDK “message history” traktuj jako mechanizm wykonawczy, a Twoje “Sessions/ReviewRuns” jako produkcyjną pamięć CLI.

Czyli:

do model call wysyłasz: minimalny zestaw: rules + project memory + (ew.) skrót sesji + diff

na dysku zapisujesz: pełen audit (inputs/outputs) + issues + statusy

6) Dodatki, które robią różnicę w CLI
Trusted repo prompt (bezpieczeństwo)
Copilot CLI wprost pyta czy ufasz katalogowi, bo agent może czytać/uruchamiać rzeczy w repo 
.
Ty też to zrób:

przy pierwszym uruchomieniu w repo: “Trust this directory?”

zapisz w ~/.config/yourtool/trusted.json

Compact / summarize sesji
Wzoruj się na /compact z Claude Code (kompresja historii do krótkiego summary) 
, ale u Ciebie to jest:

ai-review session compact

zapisuje session_summary.md

kolejne wywołania biorą summary zamiast całej historii

7) TL;DR decyzje projektowe (najlepszy układ)
Rozdziel: Session (rozmowa) vs ReviewRun (wynik review na snapshotcie) — i linkuj je.

“Background projektu” rób jako init artefakt (PROJECT_AI.md), nie jako wielki prompt za każdym razem. 

Review flow: triage → kolejka issue → drilldown on demand.

AI SDK: structured outputs + tool calling + strict per tool (AI SDK 6) 

Dodaj ai-review file <path> oraz focus <path> dla review pojedynczych plików.

Jeśli chcesz, w kolejnym kroku mogę Ci rozpisać konkretną specyfikację JSON schema dla Issue, ReviewRun, SessionEvent (tak, żeby to było gotowe do zaimplementowania), plus dokładny prompt contract dla TRIAGE i DRILLDOWN pod multi-provider (żeby modele zachowywały się spójnie).

Powiedziałeś(-aś):
Ok to teraz pytanie, w jaki sposób pozwalać userowi wybierać co tak naprawdę chce zreviewować i pod jakim kątem? Np dobrze by było zrobić możliwość użycia skills / agents którzy mają dokładnie napisane jak pod danymi względami robic review (np jeden skill security, drugi simplify, trzeci performance itd) czy w jakis inny sposob? 
ChatGPT powiedział:
Najwygodniej (i najbardziej “CLI-owo”) jest potraktować to jak profile review + soczewki (lenses), gdzie user wybiera:

co reviewujemy (zakres),

pod jakim kątem (zestaw soczewek),

jak głęboko (triage vs deep).

To da się zrobić jako “skills/agents”, ale warto to ugryźć tak, żeby było modułowe, powtarzalne i dało się łatwo dodać nowe soczewki bez przebudowy całego produktu.

1) Jak user wybiera “co reviewować” (scope)
W CLI najlepiej działa kombinacja: domyślne heurystyki + jawne flagi + tryb interaktywny.

Scope jako pierwszorzędny parametr
--scope unstaged|staged|branch|commit|range|files|paths

--files a.ts,b.ts albo --path src/ (glob)

--since HEAD~3 / --base main (jeśli chcesz review w stylu PR)

Przykłady:

ai-review → domyślnie unstaged

ai-review --staged

ai-review --files src/auth.ts,src/crypto.ts --lens security

ai-review --path src/payments --lens security,correctness

Interaktywnie (super przyjemne)
ai-review pick → pokazuje listę zmienionych plików, user zaznacza spacją (jak fzf)

potem wybór soczewek (też multi-select)

na końcu odpala review

2) Jak user wybiera “pod jakim kątem” (lenses / skills / agents)
Najlepszy model: lenses jako “prompt packs + reguły + scoring”. Czyli:

każdy lens to moduł, który potrafi:

zdefiniować “co jest problemem”,

ustawić priorytety (severity rubric),

zasugerować jakie narzędzia/kontekst są potrzebne,

wygenerować issues w tym samym schema co reszta.

Dlaczego “lens”, a nie “agent”?
“Agent” kojarzy się z autonomią i toolami. Ty możesz to mieć, ale UX jest prostszy, jeśli user wybiera lenses, a silnik ewentualnie odpala je:

równolegle w triage,

selektywnie w drilldown.

Zestawy soczewek
correctness (default)

security

performance

simplicity / refactor

tests

api-design

style (nity)

I do tego “profile” = gotowy zestaw:

--profile quick → correctness + high severity only

--profile strict → correctness+security+tests+style

--profile perf → correctness+performance

3) Jak to działa w silniku: orchiestrator + merge
Triage
Odpalasz N lensów (np. security + correctness + perf) na tym samym diffie i dostajesz N list issue’ów.

Potem robisz merge/dedupe:

klucz: fingerprint = hash(file + line_range + normalized_title + lens)

jeśli 2 lensy wykryły to samo, łączysz:

severity = max

rationale = zwięzły merge

tags = union

w UI pokazujesz jedną pozycję z tagami: [security, correctness]

Drilldown
Gdy user robi open/apply, wiesz które lensy stoją za issue → odpalasz drilldown tylko w tych soczewkach.

To daje dwa mega plusy:

szybkość (triage jest lekki),

głębia (tylko na kliknięcie).

4) Jak user steruje “głębią” i “stylem” review
Dodaj 2–3 proste pokrętła:

--depth triage|balanced|deep

triage: tylko lista issue

balanced: issue + krótkie rekomendacje

deep: issue + patch + test suggestions

--severity >=medium albo --only high,blocker

--fix (tryb “autopropozycja patchy”):

nie aplikuje automatycznie, tylko przygotowuje patch do apply

5) Jak zrobić “skills” w praktyce (plugin/pack system)
Zrób katalog np. .ai-review/lenses/ (repo-local) i ~/.config/ai-review/lenses/ (user-global).

Każdy lens to paczka:

lens.json (metadata)

system.md (instrukcje oceny)

rubric.md (jak mapować severity)

opcjonalnie checks.ts (lokalne heurystyki pre-LLM, np. “zmiana w auth/crypto => security lens auto-on”)

Metadata (przykład):

name: security

triggers: ["auth", "crypto", "sql", "serialization"]

defaultDepth: balanced

toolsNeeded: ["readFileRange", "repoSearch"]

To Ci pozwala:

łatwo dodać nowy lens bez zmiany kodu,

wersjonować soczewki,

robić community packs.

6) UX: jak user ma to wybierać bez “paraliżu decyzyjnego”
Zasada: domyślnie mądrze, ale override zawsze łatwy
default lensy: correctness, readability (albo correctness tylko)

auto-sugerowanie: jeśli diff dotyka auth/crypto/payments, CLI podpowiada:

“Wykryłem zmiany w krytycznych obszarach: dodać security lens? (Y/n)”

--no-suggest dla tych, co nie lubią promptów

Jedna komenda do “zobacz opcje”
ai-review lenses → lista dostępnych + opis + przykłady

ai-review profiles → quick/strict/perf/security-only

7) Przykładowe komendy (które zwykle “siadają” ludziom)
ai-review
→ unstaged, correctness, severity>=medium

ai-review pick
→ wybór plików + wybór lenses interaktywnie

ai-review --files src/auth.ts --lens security --depth deep

ai-review --lens correctness,performance --severity >=low

ai-review --profile strict

Jeśli chcesz, mogę Ci zaproponować konkretne schema dla LensResult i algorytm merge/dedupe (łącznie z fingerprintingiem i regułami konfliktów severity), plus “template” dwóch lensów (security + performance), żebyś od razu miał działające paczki.





No file chosenNo file chosen
ChatGPT może popełniać błędy. Sprawdź ważne informacje. Zobacz Preferencje dotyczące plików cookie.
