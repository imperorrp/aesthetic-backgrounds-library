/**
 * Your GitHub account as a sector map. Public data only (three unauthenticated
 * requests): repositories become star systems colored by language, languages
 * become factions, recent pushes, pull requests, issues, and releases become named
 * fleets, open issue titles become anomalies, and commit messages become chatter.
 */
import { hexToOklch, oklchToHex } from '../../color';
import { VOID_PACK, type PackFleet, type PackStructure, type ShipClass, type UniversePack } from './universe';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5', Rust: '#dea584', Go: '#00add8', Java: '#b07219',
  'C++': '#f34b7d', C: '#a8b9cc', 'C#': '#178600', Ruby: '#cc342d', PHP: '#4f5d95', Swift: '#f05138', Kotlin: '#a97bff',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#663399', 'Jupyter Notebook': '#da5b0b', Vue: '#41b883', Svelte: '#ff3e00',
  Dart: '#00b4ab', Lua: '#6c78d4', Haskell: '#5e5086', Elixir: '#6e4a7e', Scala: '#c22d40', Zig: '#ec915c', Nix: '#7e7eff',
  Dockerfile: '#4e8ac8', MDX: '#fcb32c', Astro: '#ff5a03', Solidity: '#aa6746', Julia: '#a270ba', R: '#198ce7',
  OCaml: '#ef7a08', Clojure: '#db5855', Elm: '#60b5cc', TeX: '#7aa16a', Makefile: '#427819', Objective_C: '#438eff',
};
const PREFIX: Record<string, string> = {
  TypeScript: 'TS', JavaScript: 'JS', Python: 'PY', Rust: 'RS', Go: 'GO', Java: 'JV', 'C++': 'CPP', C: 'C', 'C#': 'CS',
  Ruby: 'RB', PHP: 'PHP', Swift: 'SW', Kotlin: 'KT', Shell: 'SH', HTML: 'WEB', CSS: 'CSS', 'Jupyter Notebook': 'NB',
};

/** Lift dark language colors so they read on a near-black map. */
const legible = (hex: string) => {
  const c = hexToOklch(hex);
  if (!c) return hex;
  return oklchToHex({ l: Math.max(0.68, c.l), c: Math.max(0.09, c.c), h: c.h });
};
const colorOf = (lang?: string | null) => legible((lang && LANGUAGE_COLORS[lang]) || '#94a3b8');
const up = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max) : '');
const short = (repoFullName: string) => repoFullName.split('/').pop() ?? repoFullName;

type Repo = { name: string; full_name: string; language: string | null; stargazers_count: number; forks_count: number; open_issues_count: number; description: string | null; fork: boolean; archived: boolean; pushed_at: string };
type User = { login: string; name: string | null; bio: string | null; public_repos: number; followers: number; created_at: string };
type Event = { type: string; repo: { name: string }; payload: Record<string, any> };

export class GithubUniverseError extends Error {}

/** Fetch a public GitHub profile and build a universe pack from it. */
export async function githubUniverse(username: string, fetcher: typeof fetch = fetch): Promise<UniversePack> {
  const login = username.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//, '').split('/')[0];
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(login)) throw new GithubUniverseError('That does not look like a GitHub username.');
  const get = async <T,>(path: string): Promise<T> => {
    const res = await fetcher(`https://api.github.com${path}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (res.status === 404) throw new GithubUniverseError(`No GitHub user "${login}".`);
    if (res.status === 403 || res.status === 429) throw new GithubUniverseError('GitHub rate limit reached (60 requests an hour without a token). Try again later.');
    if (!res.ok) throw new GithubUniverseError(`GitHub returned ${res.status}.`);
    return (await res.json()) as T;
  };
  const [user, repos, events] = await Promise.all([
    get<User>(`/users/${login}`),
    get<Repo[]>(`/users/${login}/repos?per_page=100&sort=pushed`),
    get<Event[]>(`/users/${login}/events/public?per_page=100`).catch(() => [] as Event[]),
  ]);
  return packFromGithub(user, repos, events);
}

/** Pure mapping, exported for tests. */
export function packFromGithub(user: User, repos: Repo[], events: Event[]): UniversePack {
  const own = repos.filter((r) => !r.fork);
  const pool = own.length ? own : repos;

  // Factions: the most-used languages.
  const langCount = new Map<string, number>();
  for (const r of pool) if (r.language) langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
  const langs = [...langCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
  if (!langs.length) langs.push('Code');
  const factionOf = (lang?: string | null) => Math.max(0, langs.indexOf(lang ?? ''));
  const repoLang = new Map(repos.map((r) => [r.full_name.toLowerCase(), r.language]));

  // Systems: repositories, brightest (most starred) first.
  const ranked = [...pool].sort((a, b) => b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at));
  const systems = ranked.slice(0, 40).map((r) => ({
    name: up(r.name, 18),
    color: colorOf(r.language),
    size: 2 + Math.min(4.5, Math.log2(r.stargazers_count + 1) * 0.7),
  }));

  // Fleets: recent activity, in order.
  const fleets: PackFleet[] = [];
  const commitLines: string[] = [];
  const anomalyLabels: string[] = [];
  for (const e of events) {
    const repo = short(e.repo.name);
    const faction = factionOf(repoLang.get(e.repo.name.toLowerCase()));
    const add = (name: string, cls: ShipClass) => {
      if (!fleets.some((f) => f.name === name)) fleets.push({ name: up(name, 22), cls, faction });
    };
    switch (e.type) {
      case 'PushEvent': {
        add(`PUSH ${repo}`, 'freighter');
        for (const c of (e.payload.commits ?? []) as { message?: string }[]) {
          const line = up(c.message?.split('\n')[0], 30);
          if (line && !commitLines.includes(line)) commitLines.push(line);
        }
        break;
      }
      case 'PullRequestEvent':
        add(`PR #${e.payload.number ?? e.payload.pull_request?.number ?? ''}`, 'cruiser');
        if (e.payload.action === 'opened' && e.payload.pull_request?.title) anomalyLabels.push(up(e.payload.pull_request.title, 24));
        break;
      case 'IssuesEvent':
        add(`ISSUE #${e.payload.issue?.number ?? ''}`, 'scout');
        if (e.payload.action === 'opened' && e.payload.issue?.title) anomalyLabels.push(up(e.payload.issue.title, 24));
        break;
      case 'ReleaseEvent':
        add(`RELEASE ${e.payload.release?.tag_name ?? repo}`, 'capital');
        break;
      case 'CreateEvent':
        add(`${e.payload.ref_type === 'tag' ? 'TAG' : 'BRANCH'} ${e.payload.ref ?? repo}`, 'fighter');
        break;
      case 'ForkEvent':
        add(`FORK ${repo}`, 'carrier');
        break;
      case 'WatchEvent':
        add(`STAR ${repo}`, 'fighter');
        break;
      default:
        break;
    }
    if (fleets.length >= 40) break;
  }

  const relabel: Record<string, [string, string[]]> = {
    station: ['MAIN BRANCH', ['PROTECTED', 'GREEN SINCE TUESDAY', 'MERGE QUEUE 3', 'TAGGED AND SIGNED']],
    shipyard: ['CI RUNNER', ['BUILD #4112 PASSING', 'CACHE HIT 94%', 'MATRIX · 6 JOBS', 'ARTIFACTS UPLOADED']],
    mining_outpost: ['PACKAGE REGISTRY', ['847 DEPENDENCIES', 'LOCKFILE CHANGED', 'NEW MAJOR AVAILABLE', 'AUDIT · 2 MODERATE']],
    comm_buoy: ['WEBHOOK', ['DELIVERED 200', 'RETRYING', 'PAYLOAD 4KB', 'SECRET ROTATED']],
    defense_grid: ['BRANCH PROTECTION', ['REVIEWS REQUIRED · 1', 'FORCE PUSH DENIED', 'STATUS CHECKS ON', 'SIGNED COMMITS ONLY']],
    jumpgate: ['FORK GATE', ['UPSTREAM AHEAD 12', 'SYNCED', 'DIVERGED', 'PR FROM FORK']],
    rogue_planet: ['ORPHAN BRANCH', ['LAST COMMIT 2 YEARS AGO', 'NO UPSTREAM', 'NOBODY KNOWS']],
    derelict_hulk: ['ARCHIVED REPO', ['READ ONLY', 'LAST RELEASE V0.1', 'ISSUES CLOSED', 'STILL GETTING STARS']],
    neutron_star: ['HOT PATH', ['P99 12MS', 'CALLED 4M TIMES', 'DO NOT REFACTOR']],
    void_rift: ['LEGACY CODE', ['NO TESTS', 'ORIGINAL AUTHOR LEFT', 'DO NOT TOUCH', 'IT WORKS, SOMEHOW']],
    black_hole: ['NODE_MODULES', ['SIZE: YES', 'LIGHT DOES NOT ESCAPE', '1,204 PACKAGES']],
    dyson_sphere: ['MONOREPO', ['112 PACKAGES', 'ONE LOCKFILE', 'BUILD GRAPH HEALTHY']],
    ringworld: ['DESIGN SYSTEM', ['TOKENS SYNCED', '48 COMPONENTS', 'DARK MODE ON']],
    monolith: ['FIRST COMMIT', ['INITIAL COMMIT', 'IT STARTED HERE', `${new Date(user.created_at).getFullYear()}`]],
    stellar_lifter: ['BUILD CACHE', ['HIT RATE 97%', 'EVICTING', 'REMOTE CACHE ON']],
    matrioshka_brain: ['INFERENCE CLUSTER', ['TOKENS PER SECOND HIGH', 'CONTEXT FULL', 'THINKING']],
  };
  const structures: PackStructure[] = VOID_PACK.structures.map((s) => {
    const r = relabel[s.kind];
    return r ? { ...s, label: r[0], chatter: r[1] } : s;
  });

  const defaultsAnomalies = ['MERGE CONFLICT', 'FLAKY TEST', 'DEPENDENCY DRIFT', 'UNREVIEWED PR', 'STALE BRANCH', 'RED BUILD', 'TODO FROM 2019', 'WORKS ON MY MACHINE', 'CIRCULAR IMPORT', 'TIMEZONE BUG'];
  const styles = ['rift', 'cloud', 'wave', 'psionic', 'temporal', 'burst', 'exotic', 'singularity'] as const;
  const anomalies = [...new Set([...anomalyLabels, ...defaultsAnomalies])].slice(0, 24).map((label, i) => ({ label, style: styles[i % styles.length] }));

  const year = new Date(user.created_at).getFullYear();
  const stars = pool.reduce((s, r) => s + r.stargazers_count, 0);
  const top = ranked.slice(0, 3).map((r) => `${up(r.name, 20)} · ★${r.stargazers_count}`);
  const handle = `@${user.login.toUpperCase()}`;

  return {
    id: `github-${user.login.toLowerCase()}`,
    name: up(user.name || user.login, 30),
    tagline: user.bio ?? undefined,
    colorBy: 'faction',
    ships: { freighter: 'PUSH', cruiser: 'PULL REQUEST', scout: 'ISSUE', capital: 'RELEASE', fighter: 'BRANCH', carrier: 'FORK' },
    factions: langs.map((l) => ({ name: up(l, 20), prefix: PREFIX[l] ?? (up(l, 3).replace(/[^A-Z]/g, '') || 'GH'), color: colorOf(l) })),
    systemPrefix: 'REPO',
    systems,
    fleets,
    structures,
    anomalies,
    chatter: {
      fleet: commitLines.length ? commitLines.slice(0, 24) : ['CHANGES PUSHED', 'REBASED', 'TESTS PASSING', 'READY FOR REVIEW', 'LGTM', 'SQUASHED'],
      structure: ['BUILD PASSING', 'DEPLOY QUEUED', 'CACHE WARM', 'REVIEW REQUESTED'],
      science: [...ranked.slice(0, 8).map((r) => `${up(r.name, 16)} · ${up(r.language ?? 'TEXT', 10)}`), `${stars} STARS TOTAL`],
      mystery: ['WHO WROTE THIS', 'NO TESTS FOUND', 'CODEOWNER UNKNOWN', 'COMMENTED OUT SINCE 2021', 'MAGIC NUMBER 42'],
      system: [`${user.public_repos} PUBLIC REPOS`, `${user.followers} FOLLOWERS`, `SINCE ${year}`, 'RATE LIMIT OK'],
    },
    ambient: [
      handle,
      ...(user.name ? [up(user.name, 34)] : []),
      ...(user.bio ? [up(user.bio, 34)] : []),
      `${user.public_repos} REPOS · ${user.followers} FOLLOWERS`,
      `SHIPPING SINCE ${year}`,
      ...top,
      ...(commitLines[0] ? [`LAST · ${commitLines[0]}`.slice(0, 34)] : []),
      `${stars} STARS ACROSS THE SECTOR`,
    ].slice(0, 12),
    events: { dock: 'MERGED @ {target}', launch: 'BUILT BY {target}', cargo: 'PUBLISHING → {target}', jump: 'FORKED VIA {target}', arrive: 'UPSTREAM VIA {target}' },
  };
}
