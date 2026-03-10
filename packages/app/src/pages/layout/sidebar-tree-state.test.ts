import { describe, expect, test } from "bun:test"
import { eagerDirs, routeAncestors, visibleDirs } from "./sidebar-tree-state"

const root = { worktree: "/tmp/root", sandboxes: ["/tmp/branch"] }
const ids = (project: typeof root) => [project.worktree, ...(project.sandboxes ?? [])]

describe("routeAncestors", () => {
  test("opens both project and workspace for tree routes", () => {
    expect(routeAncestors("tree", "/tmp/root", "/tmp/branch", true)).toEqual({
      project: "/tmp/root",
      workspace: "/tmp/branch",
    })
  })

  test("skips workspace expansion when workspaces are flattened", () => {
    expect(routeAncestors("tree", "/tmp/root", "/tmp/branch", false)).toEqual({
      project: "/tmp/root",
      workspace: undefined,
    })
  })

  test("ignores non-tree mode", () => {
    expect(routeAncestors("classic", "/tmp/root", "/tmp/branch", true)).toEqual({
      project: undefined,
      workspace: undefined,
    })
  })
})

describe("visibleDirs", () => {
  test("legacy non-tree mode stays scoped to the current project root when workspaces are off", () => {
    expect(
      visibleDirs<typeof root>({
        mode: "classic",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: {},
        workspaceExpanded: {},
        ids,
        workspaces: () => false,
      }),
    ).toEqual(["/tmp/root"])
  })

  test("keeps the active workspace visible in tree mode even if ancestors were collapsed", () => {
    expect(
      visibleDirs<typeof root>({
        mode: "tree",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: { "/tmp/root": false },
        workspaceExpanded: { "/tmp/branch": false },
        ids,
        workspaces: () => true,
      }),
    ).toEqual(["/tmp/root", "/tmp/branch"])
  })

  test("shows all project session dirs directly under tree projects when workspaces are off", () => {
    expect(
      visibleDirs<typeof root>({
        mode: "tree",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: { "/tmp/root": false },
        workspaceExpanded: {},
        ids,
        workspaces: () => false,
      }),
    ).toEqual(["/tmp/root", "/tmp/branch"])
  })
})

describe("eagerDirs", () => {
  test("keeps classic mode eager scope unchanged", () => {
    expect(
      eagerDirs<typeof root>({
        mode: "classic",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: {},
        workspaceExpanded: {},
        ids,
        workspaces: () => false,
      }),
    ).toEqual(["/tmp/root"])
  })

  test("only eagerly bootstraps the active workspace for fallback-open tree projects", () => {
    expect(
      eagerDirs<typeof root>({
        mode: "tree",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: {},
        workspaceExpanded: {},
        ids,
        workspaces: () => true,
      }),
    ).toEqual(["/tmp/branch"])
  })

  test("eagerly bootstraps explicit workspace opens outside the active route", () => {
    const other = { worktree: "/tmp/other", sandboxes: ["/tmp/other-branch"] }
    const all = [root, other]
    const dirs = (project: (typeof all)[number]) => [project.worktree, ...(project.sandboxes ?? [])]
    expect(
      eagerDirs({
        mode: "tree",
        projects: all,
        project: root,
        dir: "/tmp/branch",
        projectExpanded: {},
        workspaceExpanded: { "/tmp/other-branch": true },
        ids: dirs,
        workspaces: () => true,
      }),
    ).toEqual(["/tmp/branch", "/tmp/other-branch"])
  })

  test("eagerly bootstraps all dirs for explicitly opened flattened projects", () => {
    expect(
      eagerDirs<typeof root>({
        mode: "tree",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: { "/tmp/root": true },
        workspaceExpanded: {},
        ids,
        workspaces: () => false,
      }),
    ).toEqual(["/tmp/root", "/tmp/branch"])
  })

  test("eagerly bootstraps all dirs for the active flattened project", () => {
    expect(
      eagerDirs<typeof root>({
        mode: "tree",
        projects: [root],
        project: root,
        dir: "/tmp/branch",
        projectExpanded: {},
        workspaceExpanded: {},
        ids,
        workspaces: () => false,
      }),
    ).toEqual(["/tmp/root", "/tmp/branch"])
  })
})
