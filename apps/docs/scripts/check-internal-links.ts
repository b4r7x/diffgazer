import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANDIDATE_VERDICTS } from "@diffgazer/core/providers";
import { escapeRegExp } from "@diffgazer/core/redaction";
import { REJECTED_PRODUCT_IDS } from "@diffgazer/core/schemas/config";
import { DOCS_CONTENT_ROOT, getPreRenderPages, type PreRenderPage } from "./generate-sitemap.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..");
const ORIGIN = "https://docs.example";

export interface MdxLink {
  href: string;
  line: number;
}

export interface MdxFile {
  filePath: string;
  routePath: string;
  content: string;
}

export interface BrokenInternalLink {
  filePath: string;
  line: number;
  href: string;
  resolvedPath: string;
}

export interface InternalAnchor {
  path: string;
  id: string;
}

const HEADING_PATTERN = /^#{1,6}\s+(.+)$/;
const CUSTOM_HEADING_ID_PATTERN = /\s*\[#([^\]]+)\]\s*$/;
const CODE_FENCE_PATTERN = /^\s*(?:```|~~~)/;
/** Everything github-slugger drops: keep letters, numbers, marks, hyphens and spaces. */
const HEADING_SLUG_STRIP_PATTERN = /[^\p{L}\p{N}\p{M}\- ]/gu;

function normalizePath(path: string): string {
  if (path === "") return "/";
  const withoutTrailingSlash = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return withoutTrailingSlash === "" ? "/" : withoutTrailingSlash;
}

function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

export function resolveInternalHref(href: string, routePath: string): string | null {
  const trimmed = href.trim();
  if (trimmed === "" || trimmed.startsWith("#") || isExternalHref(trimmed)) return null;

  const url = new URL(trimmed, `${ORIGIN}${routePath}`);
  if (url.origin !== ORIGIN) return null;

  return normalizePath(url.pathname);
}

/** Same-page (`#foo`) links resolve against their own route, so they are checked too. */
export function resolveInternalAnchor(href: string, routePath: string): InternalAnchor | null {
  const trimmed = href.trim();
  if (trimmed === "" || isExternalHref(trimmed)) return null;

  const url = new URL(trimmed, `${ORIGIN}${routePath}`);
  if (url.origin !== ORIGIN || url.hash === "") return null;

  return { path: normalizePath(url.pathname), id: decodeURIComponent(url.hash.slice(1)) };
}

/**
 * The id fumadocs' `remarkHeading` gives a heading: an explicit `[#id]` suffix,
 * otherwise github-slugger over the heading text (punctuation dropped, spaces
 * hyphenated) with `-1`, `-2`… suffixes for repeats within the same page.
 */
export function collectHeadingIds(content: string): Set<string> {
  const ids = new Set<string>();
  const slugCounts = new Map<string, number>();
  let insideFence = false;

  for (const line of content.split(/\r?\n/)) {
    if (CODE_FENCE_PATTERN.test(line)) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;

    const text = HEADING_PATTERN.exec(line.trimEnd())?.[1];
    if (text === undefined) continue;

    const customId = CUSTOM_HEADING_ID_PATTERN.exec(text)?.[1];
    if (customId !== undefined) {
      ids.add(customId);
      continue;
    }

    const slug = text
      .toLowerCase()
      .replace(HEADING_SLUG_STRIP_PATTERN, "")
      .trim()
      .replace(/ +/g, "-");
    const seen = slugCounts.get(slug) ?? 0;
    slugCounts.set(slug, seen + 1);
    ids.add(seen === 0 ? slug : `${slug}-${seen}`);
  }

  return ids;
}

export function extractInternalLinks(content: string): MdxLink[] {
  const links: MdxLink[] = [];
  const patterns = [/(?<!!)\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, /href="([^"]+)"/g];

  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of line.matchAll(pattern)) {
        const href = match[1];
        if (href) links.push({ href, line: index + 1 });
      }
    }
  }

  return links;
}

function walkMdxFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMdxFiles(full, files);
      continue;
    }
    if (entry.name.endsWith(".mdx")) files.push(full);
  }

  return files;
}

function fallbackRoutePath(filePath: string): string {
  const rel = relative(DOCS_CONTENT_ROOT, filePath).replace(/\.mdx$/, "");
  if (rel.startsWith("..")) {
    return `/${
      filePath
        .split("/")
        .at(-1)
        ?.replace(/\.mdx$/, "") ?? ""
    }`;
  }

  const [libId, ...rest] = rel.split("/");
  const libRel = rest.join("/").replace(/(?:^|\/)index$/, "");
  return normalizePath(libRel.length > 0 ? `/${libId}/${libRel}` : `/${libId}`);
}

function routePathBySource(pages: PreRenderPage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of pages) {
    if (page.source) map.set(page.source, page.path);
  }
  return map;
}

export function collectMdxFiles(
  roots = [resolve(DOCS_ROOT, "content/docs"), resolve(DOCS_ROOT, "content/legal")],
  pages = getPreRenderPages(),
): MdxFile[] {
  const sourceRoutes = routePathBySource(pages);
  return roots.flatMap((root) =>
    walkMdxFiles(root).map((filePath) => ({
      filePath,
      routePath: sourceRoutes.get(filePath) ?? fallbackRoutePath(filePath),
      content: readFileSync(filePath, "utf-8"),
    })),
  );
}

/**
 * The canonical entry points of the app documentation: every other page and the
 * README link into them, so they must always resolve in the prerender set.
 */
export const REQUIRED_APP_DOC_ROUTES = [
  "/app/concepts/how-it-works",
  "/app/concepts/privacy",
  "/app/concepts/providers-and-models",
  "/app/getting-started/first-review",
  "/app/operations/troubleshooting",
  "/app/reference/api",
  "/app/reference/configuration",
  "/app/reference/environment-variables",
  "/app/reference/providers",
] as const;

export type RequiredAppDocRoute = (typeof REQUIRED_APP_DOC_ROUTES)[number];

export interface RouteContractViolation {
  kind: "missing-route" | "duplicate-route" | "stale-retired-provider-link" | "broken-anchor";
  detail: string;
  filePath?: string;
  line?: number;
}

/**
 * A retired product is a rejected candidate: something the registry refuses to
 * run.  Both the id and the published name are documented subjects, so both
 * have to be guarded.
 */
interface RetiredProductSubject {
  readonly productId: string;
  readonly pattern: RegExp;
}

function retiredProductSubject(productId: string, name: string): RetiredProductSubject {
  const alternatives = [productId, name].map(escapeRegExp).join("|");
  return { productId, pattern: new RegExp(`(?<![\\w-])(?:${alternatives})(?![\\w-])`, "gi") };
}

const RETIRED_PRODUCT_SUBJECTS: readonly RetiredProductSubject[] = REJECTED_PRODUCT_IDS.map(
  (productId) => retiredProductSubject(productId, CANDIDATE_VERDICTS[productId].name),
);

const AVAILABILITY_CLAIM_PATTERN = /\b(?:selectable|enabled|available|support(?:s|ed)?)\b/gi;
const CLAIM_NEGATION_PATTERN =
  /\b(?:not|never|no|nor|cannot|isn't|aren't|without|removed|rejected|retired|unsupported|deleted|excluded)\b/i;
/** Sentence or table-cell start, so a clause-level negation cannot be read as a claim. */
const CLAIM_CLAUSE_BOUNDARY_PATTERN = /[.!?](?=\s)|\|/g;
const CLAIM_MAX_GAP = 160;

const SUPPORT_LINK_PATTERN = /\[([^\]]+)\]\([^)]+\)/g;
const SUPPORT_LINK_ACTION_PATTERN = /\b(?:setup|set up|support|enable)\b/i;

/**
 * The support matrix documents retired products by design, so a row that
 * carries a retired status cell is the correct disclosure rather than a stale
 * claim.  Parse the status cell instead of exempting any line that happens to
 * contain the words a retirement row uses.
 */
const RETIRED_TABLE_STATUSES = new Set(["rejected"]);
const MATRIX_STATUS_COLUMN_INDEX = 2;

function retiredMatrixRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  const status = trimmed
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim())[MATRIX_STATUS_COLUMN_INDEX];
  return status !== undefined && RETIRED_TABLE_STATUSES.has(status);
}

function matchRanges(line: string, pattern: RegExp): { start: number; end: number }[] {
  return [...line.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function clauseStart(line: string, index: number): number {
  let start = 0;
  for (const boundary of line.slice(0, index).matchAll(CLAIM_CLAUSE_BOUNDARY_PATTERN)) {
    start = boundary.index + boundary[0].length;
  }
  return start;
}

function claimsAvailability(line: string, subject: RetiredProductSubject): boolean {
  const subjectRanges = matchRanges(line, subject.pattern);
  if (subjectRanges.length === 0) return false;

  for (const claim of matchRanges(line, AVAILABILITY_CLAIM_PATTERN)) {
    if (CLAIM_NEGATION_PATTERN.test(line.slice(clauseStart(line, claim.start), claim.start))) {
      continue;
    }
    for (const mention of subjectRanges) {
      const gapStart = Math.min(mention.end, claim.end);
      const gapEnd = Math.max(mention.start, claim.start);
      if (gapEnd - gapStart > CLAIM_MAX_GAP) continue;
      if (!CLAIM_NEGATION_PATTERN.test(line.slice(gapStart, gapEnd))) return true;
    }
  }

  return false;
}

function linksToRetiredSupport(line: string, subject: RetiredProductSubject): boolean {
  for (const [, text] of line.matchAll(SUPPORT_LINK_PATTERN)) {
    if (text === undefined) continue;
    // Match through `matchRanges`, never `subject.pattern.test`: a successful
    // `test` on a global pattern leaves `lastIndex` past the hit, which silently
    // skips the same subject on every later line.
    if (matchRanges(text, subject.pattern).length > 0 && SUPPORT_LINK_ACTION_PATTERN.test(text)) {
      return true;
    }
  }
  return false;
}

function retiredProductViolationDetail(
  line: string,
  subject: RetiredProductSubject,
): string | null {
  if (linksToRetiredSupport(line, subject)) return `${subject.productId} support link`;
  if (claimsAvailability(line, subject)) return `${subject.productId} availability claim`;
  return null;
}

export function findStaleRetiredProviderSupportLinks(files: MdxFile[]): RouteContractViolation[] {
  const violations: RouteContractViolation[] = [];

  for (const file of files) {
    for (const [index, line] of file.content.split(/\r?\n/).entries()) {
      if (retiredMatrixRow(line)) continue;
      for (const subject of RETIRED_PRODUCT_SUBJECTS) {
        const detail = retiredProductViolationDetail(line, subject);
        if (!detail) continue;
        violations.push({
          kind: "stale-retired-provider-link",
          detail,
          filePath: file.filePath,
          line: index + 1,
        });
      }
    }
  }

  return violations;
}

export function findBrokenAnchors(files: MdxFile[]): RouteContractViolation[] {
  const idsByRoute = new Map<string, Set<string>>();
  for (const file of files) {
    const ids = idsByRoute.get(file.routePath) ?? new Set<string>();
    for (const id of collectHeadingIds(file.content)) ids.add(id);
    idsByRoute.set(file.routePath, ids);
  }

  const violations: RouteContractViolation[] = [];
  for (const file of files) {
    for (const link of extractInternalLinks(file.content)) {
      const anchor = resolveInternalAnchor(link.href, file.routePath);
      // A route with no collected source has no known id set; its path is already
      // covered by the broken-link pass, so guessing anchors there would be noise.
      const ids = anchor && idsByRoute.get(anchor.path);
      if (!anchor || !ids || ids.has(anchor.id)) continue;
      violations.push({
        kind: "broken-anchor",
        detail: `${link.href} -> ${anchor.path}#${anchor.id}`,
        filePath: file.filePath,
        line: link.line,
      });
    }
  }

  return violations;
}

export function findRouteContractViolations(
  params: { files?: MdxFile[]; pages?: PreRenderPage[] } = {},
): RouteContractViolation[] {
  const pages = params.pages ?? getPreRenderPages();
  const files = params.files ?? collectMdxFiles(undefined, pages);
  const violations: RouteContractViolation[] = [];

  const pathCounts = new Map<string, number>();
  for (const page of pages) {
    const path = normalizePath(page.path);
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
  }
  for (const [path, count] of pathCounts) {
    if (count > 1) {
      violations.push({
        kind: "duplicate-route",
        detail: `${path} appears ${count} times`,
      });
    }
  }

  const validPaths = new Set(pages.map((page) => normalizePath(page.path)));
  for (const route of REQUIRED_APP_DOC_ROUTES) {
    if (!validPaths.has(route)) {
      violations.push({ kind: "missing-route", detail: route });
    }
  }

  violations.push(...findStaleRetiredProviderSupportLinks(files));
  violations.push(...findBrokenAnchors(files));
  return violations;
}

export function findBrokenInternalLinks(
  params: { files?: MdxFile[]; pages?: PreRenderPage[] } = {},
): BrokenInternalLink[] {
  const pages = params.pages ?? getPreRenderPages();
  const validPaths = new Set(pages.map((page) => normalizePath(page.path)));
  const files = params.files ?? collectMdxFiles(undefined, pages);
  const broken: BrokenInternalLink[] = [];

  for (const file of files) {
    for (const link of extractInternalLinks(file.content)) {
      const resolvedPath = resolveInternalHref(link.href, file.routePath);
      if (!resolvedPath || validPaths.has(resolvedPath)) continue;
      broken.push({
        filePath: file.filePath,
        line: link.line,
        href: link.href,
        resolvedPath,
      });
    }
  }

  return broken;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const broken = findBrokenInternalLinks();
  const routeViolations = findRouteContractViolations();
  if (broken.length > 0 || routeViolations.length > 0) {
    const brokenDetails =
      broken.length > 0
        ? broken
            .map(
              (link) =>
                `${relative(process.cwd(), link.filePath)}:${link.line} ${link.href} -> ${link.resolvedPath}`,
            )
            .join("\n")
        : "";
    const routeDetails =
      routeViolations.length > 0
        ? routeViolations
            .map((violation) => {
              const location =
                violation.filePath && violation.line
                  ? `${relative(process.cwd(), violation.filePath)}:${violation.line} `
                  : "";
              return `${location}${violation.kind}: ${violation.detail}`;
            })
            .join("\n")
        : "";
    const sections = [
      broken.length > 0
        ? `[internal-links] ${broken.length} broken internal link(s)\n${brokenDetails}`
        : "",
      routeViolations.length > 0
        ? `[internal-links] ${routeViolations.length} route/content contract violation(s)\n${routeDetails}`
        : "",
    ].filter((section) => section.length > 0);
    console.error(sections.join("\n"));
    process.exit(1);
  }
  console.log("[internal-links] ok");
}
