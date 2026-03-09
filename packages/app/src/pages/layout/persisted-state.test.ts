import { describe, expect, test } from "bun:test"
import { PersistTesting } from "../../utils/persist"
import { DEFAULT_SIDEBAR_MODE, defaultLayoutState, migrateLayoutStore } from "../../context/layout"
import { defaultPageState, projectOpenState } from "./persisted-state"

const parse = <T>(defaults: T, value: unknown, migrate?: (value: unknown) => unknown) => {
  const raw = PersistTesting.normalize(defaults, JSON.stringify(value), migrate)
  if (!raw) return
  return JSON.parse(raw) as T
}

describe("layout sidebar mode persistence", () => {
  test("migrates legacy workspace toggle and defaults mode to classic", () => {
    const store = parse(
      defaultLayoutState(),
      {
        sidebar: {
          opened: true,
          width: 280,
          workspaces: true,
        },
      },
      migrateLayoutStore,
    )

    expect(store?.sidebar.mode).toBe(DEFAULT_SIDEBAR_MODE)
    expect(store?.sidebar.workspaces).toEqual({})
    expect(store?.sidebar.workspacesDefault).toBe(true)
  })

  test("defaults missing sidebar mode to classic", () => {
    const store = parse(
      defaultLayoutState(),
      {
        sidebar: {
          opened: true,
          width: 280,
          workspaces: {},
          workspacesDefault: true,
        },
      },
      migrateLayoutStore,
    )

    expect(store?.sidebar.mode).toBe(DEFAULT_SIDEBAR_MODE)
  })

  test("falls back to classic for invalid sidebar mode", () => {
    const store = parse(
      defaultLayoutState(),
      {
        sidebar: {
          opened: false,
          mode: "broken",
          width: 280,
          workspaces: {},
          workspacesDefault: false,
        },
      },
      migrateLayoutStore,
    )

    expect(store?.sidebar.mode).toBe(DEFAULT_SIDEBAR_MODE)
  })

  test("keeps tree sidebar mode when persisted value is valid", () => {
    const store = parse(
      defaultLayoutState(),
      {
        sidebar: {
          opened: false,
          mode: "tree",
          width: 280,
          workspaces: {},
          workspacesDefault: false,
        },
      },
      migrateLayoutStore,
    )

    expect(store?.sidebar.mode).toBe("tree")
  })
})

describe("layout page persistence", () => {
  test("adds projectExpanded without changing workspaceExpanded", () => {
    const store = parse(defaultPageState(), {
      workspaceExpanded: {
        "/tmp/root": false,
      },
    })

    expect(store?.projectExpanded).toEqual({})
    expect(store?.workspaceExpanded).toEqual({ "/tmp/root": false })
  })

  test("defaults project rows to expanded", () => {
    expect(projectOpenState({}, "/tmp/root")).toBe(true)
    expect(projectOpenState({ "/tmp/root": false }, "/tmp/root")).toBe(false)
  })
})
