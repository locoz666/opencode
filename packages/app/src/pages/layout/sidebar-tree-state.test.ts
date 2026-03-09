import { describe, expect, test } from "bun:test"
import { routeAncestors, visibleDirs } from "./sidebar-tree-state"

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

  test("ignores classic mode", () => {
    expect(routeAncestors("classic", "/tmp/root", "/tmp/branch", true)).toEqual({
      project: undefined,
      workspace: undefined,
    })
  })
})

describe("visibleDirs", () => {
  test("keeps classic mode scoped to the current project root when workspaces are off", () => {
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
