import { base64Decode } from "@opencode-ai/util/encode"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { Page } from "@playwright/test"

import { test, expect } from "../fixtures"

test.describe.configure({ mode: "serial" })
import {
  cleanupTestProject,
  clickMenuItem,
  confirmDialog,
  openSidebar,
  openWorkspaceMenu,
  slugFromUrl,
  waitSlug,
} from "../actions"
import {
  sidebarTreeWorkspaceRowSelector,
  workspaceNewSessionSelector,
  sidebarTreeProjectNewSessionSelector,
  sidebarTreeProjectNewWorkspaceSelector,
  sidebarTreeProjectWorkspacesToggleSelector,
} from "../selectors"
import { createSdk, dirSlug, modKey } from "../utils"

const layoutKey = "opencode.global.dat:layout"

async function setSidebarMode(page: Page, mode: "classic" | "tree") {
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

async function resetSidebarMode(page: Page) {
  await setSidebarMode(page, "tree")
  await page.reload()
}

async function setTreeWorkspaces(page: Page, slug: string, enabled: boolean) {
  const current = await page
    .locator(sidebarTreeProjectNewWorkspaceSelector(slug))
    .first()
    .isVisible()
    .then((x) => x)
    .catch(() => false)

  if (current === enabled) return

  const toggle = page.locator(sidebarTreeProjectWorkspacesToggleSelector(slug)).first()
  await expect(toggle).toBeVisible()
  await expect(toggle).toBeEnabled()
  await toggle.click()

  if (enabled) {
    await expect(page.locator(sidebarTreeProjectNewWorkspaceSelector(slug)).first()).toBeVisible()
    return
  }

  await expect(page.locator(sidebarTreeProjectNewSessionSelector(slug)).first()).toBeVisible()
}

async function setupWorkspaceTest(page: Page, project: { slug: string }) {
  const rootSlug = project.slug
  await openSidebar(page)

  await setTreeWorkspaces(page, rootSlug, true)

  await page.getByRole("button", { name: "New workspace" }).first().click()
  const slug = await waitSlug(page, [rootSlug])
  const dir = base64Decode(slug)

  await openSidebar(page)

  await expect
    .poll(
      async () => {
        const item = page.locator(sidebarTreeWorkspaceRowSelector(slug)).first()
        try {
          await item.hover({ timeout: 500 })
          return true
        } catch {
          return false
        }
      },
      { timeout: 60_000 },
    )
    .toBe(true)

  return { rootSlug, slug, directory: dir }
}

test("can enable and disable workspaces from project menu", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ slug }) => {
    await resetSidebarMode(page)
    await openSidebar(page)

    await expect(page.getByRole("button", { name: "New session" }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "New workspace" })).toHaveCount(0)

    await setTreeWorkspaces(page, slug, true)
    await expect(page.getByRole("button", { name: "New workspace" }).first()).toBeVisible()
    await expect(page.locator(sidebarTreeWorkspaceRowSelector(slug)).first()).toBeVisible()

    await setTreeWorkspaces(page, slug, false)
    await expect(page.getByRole("button", { name: "New session" }).first()).toBeVisible()
    await expect(page.locator(sidebarTreeWorkspaceRowSelector(slug))).toHaveCount(0)
  })
})

test("can create a workspace", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ slug }) => {
    await resetSidebarMode(page)
    await openSidebar(page)
    await setTreeWorkspaces(page, slug, true)

    await expect(page.getByRole("button", { name: "New workspace" }).first()).toBeVisible()

    await page.getByRole("button", { name: "New workspace" }).first().click()
    const workspaceSlug = await waitSlug(page, [slug])
    const workspaceDir = base64Decode(workspaceSlug)

    await openSidebar(page)

    await expect
      .poll(
        async () => {
          const item = page.locator(sidebarTreeWorkspaceRowSelector(workspaceSlug)).first()
          try {
            await item.hover({ timeout: 500 })
            return true
          } catch {
            return false
          }
        },
        { timeout: 60_000 },
      )
      .toBe(true)

    await expect(page.locator(sidebarTreeWorkspaceRowSelector(workspaceSlug)).first()).toBeVisible()

    await cleanupTestProject(workspaceDir)
  })
})

test("non-git projects keep workspace mode disabled", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  const nonGit = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-e2e-project-nongit-"))
  const nonGitSlug = dirSlug(nonGit)

  await fs.writeFile(path.join(nonGit, "README.md"), "# e2e nongit\n")

  try {
    await withProject(async () => {
      await resetSidebarMode(page)
      await page.goto(`/${nonGitSlug}/session`)

      await expect.poll(() => slugFromUrl(page.url()), { timeout: 30_000 }).not.toBe("")

      const activeDir = base64Decode(slugFromUrl(page.url()))
      expect(path.basename(activeDir)).toContain("opencode-e2e-project-nongit-")

      await openSidebar(page)
      await expect(page.getByRole("button", { name: "New workspace" })).toHaveCount(0)

      const toggle = page.locator(sidebarTreeProjectWorkspacesToggleSelector(nonGitSlug)).first()
      const hasToggle = await toggle
        .isVisible()
        .then((x) => x)
        .catch(() => false)
      if (!hasToggle) return
      await expect(toggle).toBeVisible()
      await expect(toggle).toBeDisabled()
      await expect(page.getByRole("button", { name: "New workspace" })).toHaveCount(0)
    })
  } finally {
    await cleanupTestProject(nonGit)
  }
})

test("can rename a workspace", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async (project) => {
    await resetSidebarMode(page)
    const { slug } = await setupWorkspaceTest(page, project)

    const rename = `e2e workspace ${Date.now()}`
    const menu = await openWorkspaceMenu(page, slug)
    await clickMenuItem(menu, /^Rename$/i, { force: true })

    await expect(menu).toHaveCount(0)

    const item = page.locator(`${sidebarTreeWorkspaceRowSelector(slug)}:visible`).first()
    await expect(item).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-component") ?? ""))
      .toBe("inline-input")
    await page.keyboard.press(`${modKey}+A`)
    await page.keyboard.type(rename)
    await page.keyboard.press("Enter")
    await expect(item).toContainText(rename)
  })
})

test("can reset a workspace", async ({ page, sdk, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async (project) => {
    await resetSidebarMode(page)
    const { slug, directory: createdDir } = await setupWorkspaceTest(page, project)

    const readme = path.join(createdDir, "README.md")
    const extra = path.join(createdDir, `e2e_reset_${Date.now()}.txt`)
    const original = await fs.readFile(readme, "utf8")
    const dirty = `${original.trimEnd()}\n\nchange_${Date.now()}\n`
    await fs.writeFile(readme, dirty, "utf8")
    await fs.writeFile(extra, `created_${Date.now()}\n`, "utf8")

    await expect
      .poll(async () => {
        return await fs
          .stat(extra)
          .then(() => true)
          .catch(() => false)
      })
      .toBe(true)

    await expect
      .poll(async () => {
        const files = await sdk.file
          .status({ directory: createdDir })
          .then((r) => r.data ?? [])
          .catch(() => [])
        return files.length
      })
      .toBeGreaterThan(0)

    const menu = await openWorkspaceMenu(page, slug)
    await clickMenuItem(menu, /^Reset$/i, { force: true })
    await confirmDialog(page, /^Reset workspace$/i)

    await expect
      .poll(
        async () => {
          const files = await sdk.file
            .status({ directory: createdDir })
            .then((r) => r.data ?? [])
            .catch(() => [])
          return files.length
        },
        { timeout: 60_000 },
      )
      .toBe(0)

    await expect.poll(() => fs.readFile(readme, "utf8"), { timeout: 60_000 }).toBe(original)

    await expect
      .poll(async () => {
        return await fs
          .stat(extra)
          .then(() => true)
          .catch(() => false)
      })
      .toBe(false)
  })
})

test("can delete a workspace", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async (project) => {
    await resetSidebarMode(page)
    const sdk = createSdk(project.directory)
    const { rootSlug, slug, directory } = await setupWorkspaceTest(page, project)

    await expect
      .poll(
        async () => {
          const worktrees = await sdk.worktree
            .list()
            .then((r) => r.data ?? [])
            .catch(() => [] as string[])
          return worktrees.includes(directory)
        },
        { timeout: 30_000 },
      )
      .toBe(true)

    const menu = await openWorkspaceMenu(page, slug)
    await clickMenuItem(menu, /^Delete$/i, { force: true })
    await confirmDialog(page, /^Delete workspace$/i)

    await expect.poll(() => base64Decode(slugFromUrl(page.url()))).toBe(project.directory)

    await expect
      .poll(
        async () => {
          const worktrees = await sdk.worktree
            .list()
            .then((r) => r.data ?? [])
            .catch(() => [] as string[])
          return worktrees.includes(directory)
        },
        { timeout: 60_000 },
      )
      .toBe(false)

    await project.gotoSession()

    await openSidebar(page)
    await expect(page.locator(sidebarTreeWorkspaceRowSelector(slug))).toHaveCount(0, { timeout: 60_000 })
    await expect(page.locator(sidebarTreeWorkspaceRowSelector(rootSlug)).first()).toBeVisible()
  })
})

test("can reorder workspaces by drag and drop", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })
  await withProject(async ({ slug: rootSlug }) => {
    await resetSidebarMode(page)
    const workspaces = [] as { directory: string; slug: string }[]

    const listSlugs = async () => {
      const nodes = page.locator('[data-component="sidebar-nav-desktop"] [data-component="sidebar-workspace-item"]')
      const slugs = await nodes.evaluateAll((els) => {
        return els.map((el) => el.getAttribute("data-workspace") ?? "").filter((x) => x.length > 0)
      })
      return slugs
    }

    const waitReady = async (slug: string) => {
      await expect
        .poll(
          async () => {
            const item = page.locator(sidebarTreeWorkspaceRowSelector(slug)).first()
            try {
              await item.hover({ timeout: 500 })
              return true
            } catch {
              return false
            }
          },
          { timeout: 60_000 },
        )
        .toBe(true)
    }

    const drag = async (from: string, to: string) => {
      const src = page.locator(sidebarTreeWorkspaceRowSelector(from)).first()
      const dst = page.locator(sidebarTreeWorkspaceRowSelector(to)).first()

      const a = await src.boundingBox()
      const b = await dst.boundingBox()
      if (!a || !b) throw new Error("Failed to resolve workspace drag bounds")

      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
      await page.mouse.up()
    }

    try {
      await openSidebar(page)

      await setTreeWorkspaces(page, rootSlug, true)

      for (const _ of [0, 1]) {
        const prev = slugFromUrl(page.url())
        await page.getByRole("button", { name: "New workspace" }).first().click()
        const slug = await waitSlug(page, [rootSlug, prev])
        const dir = base64Decode(slug)
        workspaces.push({ slug, directory: dir })

        await openSidebar(page)
      }

      if (workspaces.length !== 2) throw new Error("Expected two created workspaces")

      const a = workspaces[0].slug
      const b = workspaces[1].slug

      await waitReady(a)
      await waitReady(b)

      const list = async () => {
        const slugs = await listSlugs()
        return slugs.filter((s) => s !== rootSlug && (s === a || s === b)).slice(0, 2)
      }

      await expect
        .poll(async () => {
          const slugs = await list()
          return slugs.length === 2
        })
        .toBe(true)

      const before = await list()
      const from = before[1]
      const to = before[0]
      if (!from || !to) throw new Error("Failed to resolve initial workspace order")

      await drag(from, to)

      await expect.poll(async () => await list()).toEqual([from, to])
    } finally {
      await Promise.all(workspaces.map((w) => cleanupTestProject(w.directory)))
    }
  })
})

test("tree mode: project-level plus creates session when worktrees disabled", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ slug }) => {
    await setSidebarMode(page, "tree")
    await openSidebar(page)

    await expect(page.getByRole("button", { name: "New session" }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "New workspace" })).toHaveCount(0)

    await page.locator(sidebarTreeProjectNewSessionSelector(slug)).first().click()

    await expect.poll(() => slugFromUrl(page.url()), { timeout: 30_000 }).toBe(slug)
    expect(page.url()).toContain("/session")
  })
})

test("tree mode: project-level plus creates workspace when worktrees enabled", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ slug }) => {
    await setSidebarMode(page, "tree")
    await openSidebar(page)

    const toggle = page.locator(sidebarTreeProjectWorkspacesToggleSelector(slug)).first()
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeEnabled()
    await toggle.click()

    await expect(page.locator(sidebarTreeProjectNewWorkspaceSelector(slug)).first()).toBeVisible()
    await expect(page.locator(sidebarTreeProjectNewWorkspaceSelector(slug)).first()).toBeEnabled()

    await page.locator(sidebarTreeProjectNewWorkspaceSelector(slug)).first().click()

    const workspaceSlug = await waitSlug(page, [slug])
    expect(workspaceSlug).not.toBe(slug)

    const workspaceDir = base64Decode(workspaceSlug)
    await cleanupTestProject(workspaceDir)
  })
})

test("tree mode: git project with zero extra worktrees can enable worktrees from project row", async ({
  page,
  withProject,
}) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ slug }) => {
    await setSidebarMode(page, "tree")
    await openSidebar(page)

    await expect(page.getByRole("button", { name: "New session" }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "New workspace" })).toHaveCount(0)

    const toggle = page.locator(sidebarTreeProjectWorkspacesToggleSelector(slug)).first()
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeEnabled()

    await toggle.click()

    await expect(page.getByRole("button", { name: "New workspace" }).first()).toBeVisible()
    await expect(toggle).toBeEnabled()
  })
})

test("tree mode: workspace-level plus creates session", async ({ page, withProject }) => {
  await page.setViewportSize({ width: 1400, height: 800 })

  await withProject(async ({ slug }) => {
    await setSidebarMode(page, "tree")
    await openSidebar(page)

    const toggle = page.locator(sidebarTreeProjectWorkspacesToggleSelector(slug)).first()
    await expect(toggle).toBeVisible()
    await toggle.click()

    await page.locator(sidebarTreeProjectNewWorkspaceSelector(slug)).first().click()

    const workspaceSlug = await waitSlug(page, [slug])
    const workspaceDir = base64Decode(workspaceSlug)

    await openSidebar(page)
    const create = page.locator(workspaceNewSessionSelector(workspaceSlug)).first()
    await expect(create).toBeVisible()
    await create.click()

    await expect.poll(() => slugFromUrl(page.url()), { timeout: 30_000 }).toBe(workspaceSlug)
    expect(page.url()).toContain("/session")

    await cleanupTestProject(workspaceDir)
  })
})
