import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { Page } from "@playwright/test"
import { test, expect } from "../fixtures"
import { cleanupTestProject, openSidebar } from "../actions"
import {
  promptSelector,
  projectMenuTriggerSelector,
  sessionItemSelector,
  sidebarModeToggleSelector,
  sidebarTreeProjectItemSelector,
  sidebarTreeProjectToggleSelector,
  sidebarTreeWorkspaceItemSelector,
  sidebarTreeWorkspaceToggleSelector,
} from "../selectors"
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

test("classic mode remains available and tree mode persists after reload", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ gotoSession, slug }) => {
    await gotoSession()
    await openSidebar(page)

    const mode = page.locator(sidebarModeToggleSelector).first()
    await expect(mode).toBeVisible()
    await expect(page.locator(sidebarTreeProjectItemSelector)).toHaveCount(0)

    await mode.click()
    await expect(page.locator(sidebarTreeProjectItemSelector).first()).toBeVisible()

    await page.reload()
    await expect(page.locator(promptSelector)).toBeVisible()
    await openSidebar(page)
    await expect(page.locator(sidebarTreeProjectItemSelector).first()).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/${slug}/session`))

    await page.locator(sidebarModeToggleSelector).first().click()
    await expect(page.locator(sidebarTreeProjectItemSelector)).toHaveCount(0)
    await expect(page.locator(projectMenuTriggerSelector(slug)).first()).toBeVisible()
  })
})

test("tree mode shows git project as project -> workspace -> session and keeps navigation active", async ({
  page,
  withProject,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ directory, gotoSession, trackDirectory, trackSession }) => {
    const stamp = Date.now()
    const sdk = createSdk(directory)

    const root = await sdk.session.create({ title: `e2e tree root ${stamp}` }).then((r) => r.data)
    if (!root?.id) throw new Error("Failed to create root session")
    trackSession(root.id, directory)

    const created = await sdk.worktree.create().then((r) => r.data)
    if (!created?.directory) throw new Error("Failed to create workspace")
    const workspaceDir = await resolveDirectory(created.directory)
    trackDirectory(workspaceDir)

    const wsSdk = createSdk(workspaceDir)
    const ws = await wsSdk.session.create({ title: `e2e tree workspace ${stamp}` }).then((r) => r.data)
    if (!ws?.id) throw new Error("Failed to create workspace session")
    trackSession(ws.id, workspaceDir)

    await gotoSession(root.id)
    await setSidebarMode(page, "tree")
    await setWorkspaceMode(page, directory, true)
    await page.reload()
    await expect(page.locator(promptSelector)).toBeVisible()

    await openSidebar(page)

    const projectToggle = page.locator(sidebarTreeProjectToggleSelector).first()
    const workspaceItems = page.locator(sidebarTreeWorkspaceItemSelector)
    const workspaceToggles = page.locator(sidebarTreeWorkspaceToggleSelector)

    await expect(page.locator(sidebarTreeProjectItemSelector).first()).toBeVisible()
    await expect(workspaceItems).toHaveCount(2)

    await projectToggle.click()
    await expect(workspaceItems).toHaveCount(0)
    await projectToggle.click()
    await expect(workspaceItems).toHaveCount(2)

    await workspaceToggles.first().click()
    await expect(page.locator(sessionItemSelector(root.id))).toHaveCount(0)
    await workspaceToggles.first().click()
    await expect(page.locator(sessionItemSelector(root.id)).first()).toBeVisible()

    await workspaceToggles.nth(1).click()
    const target = page.locator(`${sessionItemSelector(ws.id)} a`).first()
    await expect(target).toBeVisible()
    await target.click()

    const slug = dirSlug(workspaceDir)
    await expect(page).toHaveURL(new RegExp(`/${slug}/session/${ws.id}(?:[/?#]|$)`))
    await expect(page.locator(`${sessionItemSelector(ws.id)} a`).first()).toHaveClass(/\bactive\b/)
  })
})

test("tree mode flattens git project to project -> session when workspaces are disabled", async ({
  page,
  withProject,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ directory, gotoSession, trackDirectory, trackSession }) => {
    const stamp = Date.now()
    const sdk = createSdk(directory)

    const root = await sdk.session.create({ title: `e2e flat root ${stamp}` }).then((r) => r.data)
    if (!root?.id) throw new Error("Failed to create root session")
    trackSession(root.id, directory)

    const created = await sdk.worktree.create().then((r) => r.data)
    if (!created?.directory) throw new Error("Failed to create workspace")
    const workspaceDir = await resolveDirectory(created.directory)
    trackDirectory(workspaceDir)

    const wsSdk = createSdk(workspaceDir)
    const ws = await wsSdk.session.create({ title: `e2e flat workspace ${stamp}` }).then((r) => r.data)
    if (!ws?.id) throw new Error("Failed to create workspace session")
    trackSession(ws.id, workspaceDir)

    await gotoSession(root.id)
    await setSidebarMode(page, "tree")
    await setWorkspaceMode(page, directory, false)
    await page.reload()
    await expect(page.locator(promptSelector)).toBeVisible()

    await openSidebar(page)
    await expect(page.locator(sidebarTreeProjectItemSelector).first()).toBeVisible()
    await expect(page.locator(sidebarTreeWorkspaceItemSelector)).toHaveCount(0)
    await expect(page.locator(sessionItemSelector(root.id)).first()).toBeVisible()
    await expect(page.locator(sessionItemSelector(ws.id)).first()).toBeVisible()
  })
})

test("non-git projects never render workspace rows in tree mode", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  const nonGit = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-e2e-tree-nongit-"))
  await fs.writeFile(path.join(nonGit, "README.md"), "# e2e tree nongit\n")

  try {
    await withProject(
      async () => {
        await setSidebarMode(page, "tree")
        await setWorkspaceMode(page, nonGit, true)
        await page.goto(`/${dirSlug(nonGit)}/session`)
        await expect(page.locator(promptSelector)).toBeVisible()

        await openSidebar(page)
        const item = page
          .locator(sidebarTreeProjectItemSelector)
          .filter({ hasText: path.basename(nonGit) })
          .first()
        await expect(item).toBeVisible()
        await expect(item.locator('[data-component="sidebar-workspace-item"]')).toHaveCount(0)
      },
      { extra: [nonGit] },
    )
  } finally {
    await cleanupTestProject(nonGit)
  }
})
