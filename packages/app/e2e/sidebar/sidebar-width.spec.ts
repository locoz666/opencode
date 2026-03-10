import { test, expect } from "../fixtures"
import { cleanupSession, openSidebar } from "../actions"
import { sessionItemSelector, sidebarNavSelector } from "../selectors"

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
