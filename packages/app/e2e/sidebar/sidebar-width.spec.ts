import type { Page } from "@playwright/test"
import { test, expect } from "../fixtures"
import { cleanupSession, openSidebar } from "../actions"
import { sessionItemSelector, sidebarNavSelector, workspaceItemSelector } from "../selectors"
import { createSdk, dirSlug, resolveDirectory } from "../utils"

const layoutKey = "opencode.global.dat:layout"

const setSidebarMode = async (page: Page, mode: "classic" | "tree") => {
  await page.evaluate(
    ({ mode, key }: { mode: "classic" | "tree"; key: string }) => {
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : {}
      const sidebar = data.sidebar && typeof data.sidebar === "object" ? data.sidebar : {}
      localStorage.setItem(
        key,
        JSON.stringify({
          ...data,
          sidebar: {
            ...sidebar,
            mode,
          },
        }),
      )
    },
    { mode, key: layoutKey },
  )
}

const setWorkspaceMode = async (page: Page, directory: string, enabled: boolean) => {
  await page.evaluate(
    ({ key, directory, enabled }: { key: string; directory: string; enabled: boolean }) => {
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : {}
      const sidebar = data.sidebar && typeof data.sidebar === "object" ? data.sidebar : {}
      const current =
        sidebar.workspaces && typeof sidebar.workspaces === "object" && !Array.isArray(sidebar.workspaces)
          ? sidebar.workspaces
          : {}
      const next = { ...current }
      if (enabled) next[directory] = true
      if (!enabled) delete next[directory]
      localStorage.setItem(
        key,
        JSON.stringify({
          ...data,
          sidebar: {
            ...sidebar,
            workspaces: next,
          },
        }),
      )
    },
    { key: layoutKey, directory, enabled },
  )
}

test("sidebar keeps a fixed default width and truncates long session titles while resizing", async ({
  page,
  sdk,
  gotoSession,
}) => {
  const stamp = Date.now()
  const prefix = "ULTRAWORK MODE ENABLED"
  const current = await sdk.session.create({ title: `e2e sidebar width current ${stamp}` }).then((r) => r.data)
  const target = await sdk.session
    .create({ title: `${prefix} ${"syncing project history ".repeat(18)}${stamp}` })
    .then((r) => r.data)

  if (!current?.id) throw new Error("Session create did not return an id")
  if (!target?.id) throw new Error("Session create did not return an id")

  try {
    await page.addInitScript(() => localStorage.removeItem("opencode.global.dat:layout"))
    await gotoSession(current.id)
    await openSidebar(page)

    const nav = page.locator(sidebarNavSelector)
    const row = page.locator(`${sessionItemSelector(target.id)} a`).first()
    const label = row.locator("span").filter({ hasText: prefix }).first()

    const resize = async (width: number) => {
      await page.evaluate((width) => {
        const nav = document.querySelector('[data-component="sidebar-nav-desktop"]')
        if (!(nav instanceof HTMLElement)) throw new Error("Sidebar nav missing")

        nav.style.width = `${width}px`

        const shell = nav.firstElementChild?.firstElementChild
        if (!(shell instanceof HTMLElement)) throw new Error("Sidebar shell missing")

        const panel = shell.children.item(1)?.firstElementChild
        if (!(panel instanceof HTMLElement)) throw new Error("Sidebar panel missing")

        panel.style.width = `${Math.max(width, 244) - 64}px`
      }, width)
      await expect(row).toBeVisible()
    }

    const measure = async () =>
      row.evaluate((el, prefix) => {
        const spans = el.querySelectorAll("span")
        const label = Array.from(spans).find((span) => span.textContent?.includes(prefix))
        if (!(label instanceof HTMLElement)) throw new Error("Session label missing")
        const box = label.getBoundingClientRect()
        const style = getComputedStyle(label)
        return {
          width: box.width,
          scroll: label.scrollWidth,
          overflow: style.overflow,
          paddingRight: style.paddingRight,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        }
      }, prefix)

    await expect(nav).toBeVisible()
    await expect(label).toBeVisible()
    await expect.poll(async () => Math.round((await nav.boundingBox())?.width ?? 0)).toBe(344)

    await resize(248)

    await expect.poll(async () => Math.round((await nav.boundingBox())?.width ?? 0)).toBe(248)
    const narrow = await measure()
    expect(narrow.scroll).toBeGreaterThan(narrow.width)
    expect(narrow.textOverflow).toBe("ellipsis")
    expect(narrow.whiteSpace).toBe("nowrap")
    expect(narrow.overflow).toBe("hidden")
    expect(Number.parseFloat(narrow.paddingRight)).toBeGreaterThan(0)

    await resize(392)

    await expect.poll(async () => Math.round((await nav.boundingBox())?.width ?? 0)).toBe(392)
  } finally {
    await cleanupSession({ sdk, sessionID: current.id })
    await cleanupSession({ sdk, sessionID: target.id })
  }
})

test("classic workspace sidebar keeps long session rows inside bounds and still widens by drag", async ({
  page,
  withProject,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ directory, gotoSession, trackDirectory, trackSession }) => {
    const stamp = Date.now()
    const prefix = "workspace sidebar overflow"
    const sdk = createSdk(directory)

    const root = await sdk.session.create({ title: `e2e classic root ${stamp}` }).then((r) => r.data)
    if (!root?.id) throw new Error("Failed to create root session")
    trackSession(root.id, directory)

    const created = await sdk.worktree.create().then((r) => r.data)
    if (!created?.directory) throw new Error("Failed to create workspace")
    const workspaceDir = await resolveDirectory(created.directory)
    trackDirectory(workspaceDir)

    const wsSdk = createSdk(workspaceDir)
    const ws = await wsSdk.session
      .create({ title: `${prefix} ${"workspace sidebar overflow ".repeat(15)}${stamp}` })
      .then((r) => r.data)
    if (!ws?.id) throw new Error("Failed to create workspace session")
    trackSession(ws.id, workspaceDir)

    await gotoSession(root.id)
    await setSidebarMode(page, "classic")
    await setWorkspaceMode(page, directory, true)
    await gotoSession(ws.id)
    await page.reload()
    await openSidebar(page)

    const nav = page.locator(sidebarNavSelector)
    const workspace = page.locator(workspaceItemSelector(dirSlug(workspaceDir))).first()
    const row = page.locator(sessionItemSelector(ws.id)).first()
    const handle = page.locator('[data-component="resize-handle"][data-direction="horizontal"]').first()

    const resize = async (width: number) => {
      await page.evaluate((width) => {
        const nav = document.querySelector('[data-component="sidebar-nav-desktop"]')
        if (!(nav instanceof HTMLElement)) throw new Error("Sidebar nav missing")

        nav.style.width = `${width}px`

        const shell = nav.firstElementChild?.firstElementChild
        if (!(shell instanceof HTMLElement)) throw new Error("Sidebar shell missing")

        const panel = shell.children.item(1)?.firstElementChild
        if (!(panel instanceof HTMLElement)) throw new Error("Sidebar panel missing")

        panel.style.width = `${Math.max(width, 244) - 64}px`
      }, width)
      await expect(row).toBeVisible()
    }

    await expect(nav).toBeVisible()
    await expect(workspace).toBeVisible()
    if ((await row.count()) === 0) {
      await workspace.locator('[data-action="workspace-toggle"]').click()
    }
    await expect(row).toBeVisible()

    await resize(248)

    const label = row.locator("span").filter({ hasText: prefix }).first()
    const labelState = await label.evaluate((el) => {
      if (!(el instanceof HTMLElement)) throw new Error("Workspace label missing")
      const style = getComputedStyle(el)
      return {
        width: el.getBoundingClientRect().width,
        scroll: el.scrollWidth,
        overflow: style.overflow,
        textOverflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
      }
    })

    expect(labelState.scroll).toBeGreaterThan(labelState.width)
    expect(labelState.overflow).toBe("hidden")
    expect(labelState.textOverflow).toBe("ellipsis")
    expect(labelState.whiteSpace).toBe("nowrap")

    await expect(handle).toBeVisible()
  })
})
