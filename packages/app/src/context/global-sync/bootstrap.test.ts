import { describe, expect, test } from "bun:test"
import type { OpencodeClient, Path } from "@opencode-ai/sdk/v2/client"
import { createStore } from "solid-js/store"
import { bootstrapDirectory } from "./bootstrap"
import type { State } from "./types"

const path = {
  state: "",
  config: "",
  worktree: "/tmp/repo",
  directory: "/tmp/repo",
  home: "/tmp",
} satisfies Path

const base = () =>
  ({
    status: "loading",
    agent: [],
    command: [],
    project: "",
    projectMeta: undefined,
    icon: undefined,
    provider: { all: [], connected: [], default: {} },
    config: {},
    path,
    session: [],
    sessionTotal: 0,
    session_status: {},
    session_diff: {},
    todo: {},
    permission: {},
    question: {},
    mcp: {},
    lsp: [],
    vcs: undefined,
    limit: 5,
    message: {},
    part: {},
  }) as State

const settle = async (store: State) => {
  for (let i = 0; i < 10; i += 1) {
    if (store.status === "complete") return
    await Promise.resolve()
  }
}

const setup = (seed?: Path) => {
  const calls = {
    project: 0,
    provider: 0,
    agent: 0,
    config: 0,
    path: 0,
    command: 0,
    session: 0,
    mcp: 0,
    lsp: 0,
    vcs: 0,
    permission: 0,
    question: 0,
    sessions: 0,
  }
  const sdk = {
    project: {
      current: async () => {
        calls.project += 1
        return { data: { id: "proj" } }
      },
    },
    provider: {
      list: async () => {
        calls.provider += 1
        return { data: { all: [], connected: [], default: {} } }
      },
    },
    app: {
      agents: async () => {
        calls.agent += 1
        return { data: [] }
      },
    },
    config: {
      get: async () => {
        calls.config += 1
        return { data: {} }
      },
    },
    path: {
      get: async () => {
        calls.path += 1
        return { data: path }
      },
    },
    command: {
      list: async () => {
        calls.command += 1
        return { data: [] }
      },
    },
    session: {
      status: async () => {
        calls.session += 1
        return { data: {} }
      },
    },
    mcp: {
      status: async () => {
        calls.mcp += 1
        return { data: {} }
      },
    },
    lsp: {
      status: async () => {
        calls.lsp += 1
        return { data: [] }
      },
    },
    vcs: {
      get: async () => {
        calls.vcs += 1
        return { data: { branch: "main" } }
      },
    },
    permission: {
      list: async () => {
        calls.permission += 1
        return { data: [] }
      },
    },
    question: {
      list: async () => {
        calls.question += 1
        return { data: [] }
      },
    },
  } as unknown as OpencodeClient

  const [store, setStore] = createStore(base())
  const [cache, setCache] = createStore({ value: undefined as State["vcs"] })

  return {
    calls,
    store,
    run: () =>
      bootstrapDirectory({
        directory: path.directory,
        path: seed,
        sdk,
        store,
        setStore,
        vcsCache: {
          store: cache,
          setStore: setCache,
          ready: () => true,
        },
        loadSessions: async () => {
          calls.sessions += 1
        },
        translate: (x) => x,
      }),
  }
}

describe("bootstrapDirectory", () => {
  test("reuses seeded path and skips path request", async () => {
    const app = setup(path)

    await app.run()
    await settle(app.store)

    expect(app.store.status).toBe("complete")
    expect(app.store.path.directory).toBe(path.directory)
    expect(app.calls.path).toBe(0)
    expect(app.calls.project).toBe(1)
    expect(app.calls.provider).toBe(1)
    expect(app.calls.agent).toBe(1)
    expect(app.calls.config).toBe(1)
    expect(app.calls.command).toBe(1)
    expect(app.calls.session).toBe(1)
    expect(app.calls.mcp).toBe(1)
    expect(app.calls.lsp).toBe(1)
    expect(app.calls.vcs).toBe(1)
    expect(app.calls.permission).toBe(1)
    expect(app.calls.question).toBe(1)
    expect(app.calls.sessions).toBe(1)
  })

  test("requests path once when path is not seeded", async () => {
    const app = setup()

    await app.run()
    await settle(app.store)

    expect(app.store.status).toBe("complete")
    expect(app.calls.path).toBe(1)
    expect(app.calls.project).toBe(1)
    expect(app.calls.provider).toBe(1)
    expect(app.calls.agent).toBe(1)
    expect(app.calls.config).toBe(1)
    expect(app.calls.command).toBe(1)
    expect(app.calls.session).toBe(1)
    expect(app.calls.mcp).toBe(1)
    expect(app.calls.lsp).toBe(1)
    expect(app.calls.vcs).toBe(1)
    expect(app.calls.permission).toBe(1)
    expect(app.calls.question).toBe(1)
    expect(app.calls.sessions).toBe(1)
  })
})
