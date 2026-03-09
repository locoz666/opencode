import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { treeProjects } from "./sidebar-tree-helpers"

const session = (id: string, directory: string): Session => ({
  id,
  slug: id,
  projectID: directory,
  version: "0",
  directory,
  title: id,
  parentID: undefined,
  time: {
    created: 0,
    updated: 0,
    archived: undefined,
  },
})

describe("treeProjects", () => {
  test("keeps projects as the top-level order", () => {
    const projects = [
      { worktree: "/repo/alpha", sandboxes: ["/repo/alpha-sbx"], vcs: "git" },
      { worktree: "/repo/beta", sandboxes: ["/repo/beta-sbx"], vcs: "git" },
    ]

    const result = treeProjects({
      projects,
      sessions: {
        "/repo/alpha": [session("alpha-root", "/repo/alpha")],
        "/repo/alpha-sbx": [session("alpha-sbx", "/repo/alpha-sbx")],
        "/repo/beta": [session("beta-root", "/repo/beta")],
        "/repo/beta-sbx": [session("beta-sbx", "/repo/beta-sbx")],
      },
      ids: (item) => [item.worktree, ...(item.sandboxes ?? [])],
      workspaces: () => true,
    })

    expect(result.map((item) => item.project.worktree)).toEqual(["/repo/alpha", "/repo/beta"])
    expect(result[0].workspaces.map((item) => item.directory)).toEqual(["/repo/alpha", "/repo/alpha-sbx"])
    expect(result[1].workspaces.map((item) => item.directory)).toEqual(["/repo/beta", "/repo/beta-sbx"])
  })

  test("keeps git workspaces as intermediate rows when enabled", () => {
    const project = { worktree: "/repo/app", sandboxes: ["/repo/app-sbx"], vcs: "git" }

    const result = treeProjects({
      projects: [project],
      sessions: {
        "/repo/app": [session("root-1", "/repo/app")],
        "/repo/app-sbx": [session("sbx-1", "/repo/app-sbx")],
      },
      ids: (item) => [item.worktree, ...(item.sandboxes ?? [])],
      workspaces: () => true,
    })

    expect(result).toHaveLength(1)
    expect(result[0].leaves).toEqual([])
    expect(result[0].workspaces.map((item) => item.directory)).toEqual(["/repo/app", "/repo/app-sbx"])
    expect(result[0].workspaces[0].leaves.map((item) => item.session.id)).toEqual(["root-1"])
    expect(result[0].workspaces[1].leaves.map((item) => item.session.id)).toEqual(["sbx-1"])
  })

  test("flattens git project sessions under the project when workspaces are off", () => {
    const project = { worktree: "/repo/app", sandboxes: ["/repo/app-sbx"], vcs: "git" }

    const result = treeProjects({
      projects: [project],
      sessions: {
        "/repo/app": [session("root-1", "/repo/app")],
        "/repo/app-sbx": [session("sbx-1", "/repo/app-sbx")],
      },
      ids: (item) => [item.worktree, ...(item.sandboxes ?? [])],
      workspaces: () => false,
    })

    expect(result[0].workspaces).toEqual([])
    expect(result[0].leaves.map((item) => item.session.id)).toEqual(["root-1", "sbx-1"])
  })

  test("ignores workspace mode for non-git projects", () => {
    const project = { worktree: "/repo/plain", sandboxes: ["/repo/plain-sbx"], vcs: "none" }

    const result = treeProjects({
      projects: [project],
      sessions: {
        "/repo/plain": [session("root-1", "/repo/plain")],
        "/repo/plain-sbx": [session("sbx-1", "/repo/plain-sbx")],
      },
      ids: (item) => [item.worktree, ...(item.sandboxes ?? [])],
      workspaces: () => true,
    })

    expect(result[0].workspaces).toEqual([])
    expect(result[0].leaves.map((item) => item.directory)).toEqual(["/repo/plain", "/repo/plain-sbx"])
  })
})
