  const newState = await toggleInput.evaluate((el: HTMLInputElement) => el.checked)
  expect(newState).toBe(false)

  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, settingsKey)

  expect(stored?.general?.releaseNotes).toBe(false)
})

test("changing session width persists in localStorage", async ({ page, gotoSession }) => {
  await gotoSession()

  const dialog = await openSettings(page)
  const select = dialog.locator(settingsSessionWidthSelector)
  await expect(select).toBeVisible()

  await select.locator('[data-slot="select-select-trigger"]').click()

  const items = page.locator('[data-slot="select-select-item"]')
  expect(await items.count()).toBeGreaterThanOrEqual(3)

  await items.nth(2).click()

  await expect
    .poll(async () => {
      const stored = await page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      }, settingsKey)
      return stored?.appearance?.sessionWidth
    })
    .not.toBe("narrow")
})

test("changing session width updates desktop prompt width", async ({ page, gotoSession }) => {
  await page.setViewportSize({ width: 1800, height: 1200 })
  await gotoSession()

  const reviewToggle = page.getByRole("button", { name: "Toggle review" }).first()
  await expect(reviewToggle).toBeVisible()
  if ((await reviewToggle.getAttribute("aria-expanded")) === "true") await reviewToggle.click()
  await expect(reviewToggle).toHaveAttribute("aria-expanded", "false")

  const dialog = await openSettings(page)
  const select = dialog.locator(settingsSessionWidthSelector)
  await expect(select).toBeVisible()

  const width = async () => {
    const box = await page.locator('[data-component="prompt-input"]').boundingBox()
    expect(box).toBeTruthy()
    return box!.width
  }

  const pick = async (label: string) => {
    await select.locator('[data-slot="select-select-trigger"]').click()
    await page.locator('[data-slot="select-select-item"]').filter({ hasText: label }).click()
  }

  await pick("Narrow")
  const narrow = await width()

  await pick("Wide")
  await expect.poll(width).toBeGreaterThan(narrow + 200)
  const wide = await width()

  await pick("Auto")
  await expect.poll(width).toBe(wide)

  const box = await page.locator('[data-component="prompt-input"]').boundingBox()
  expect(box).toBeTruthy()
  expect(box!.x).toBeGreaterThan(0)
  expect(1800 - (box!.x + box!.width)).toBeGreaterThan(0)
})

test("selecting custom sound persists in localStorage with filename", async ({ page, gotoSession }) => {
  await page.addInitScript(() => {
    localStorage.setItem("opencode.global.dat:language", JSON.stringify({ locale: "en" }))
  })

  await gotoSession()

  const dialog = await openSettings(page)
  const select = dialog.locator(settingsSoundsAgentSelector)
  await expect(select).toBeVisible()

  await select.locator('[data-slot="select-select-trigger"]').click()

  const items = page.locator('[data-slot="select-select-item"]')
  const customItem = items.filter({ hasText: /Custom/i })
  await expect(customItem).toBeVisible()
  await customItem.click()

  const fileInput = dialog.locator('input[type="file"][id="sound-file-input-agent"]')
  await expect(fileInput).toBeAttached()

  await fileInput.setInputFiles({
    name: "test-sound.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "base64"),
  })

  await expect
    .poll(async () => {
      return await page.evaluate((key) => {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      }, settingsKey)
    })
    .toMatchObject({
      sounds: {
        agent: "custom",
        agentEnabled: true,
      },
    })

  const stored = await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  }, settingsKey)

  expect(stored?.sounds?.agentCustom).toBeDefined()
  expect(stored?.sounds?.agentCustom?.name).toBe("test-sound.wav")
  expect(stored?.sounds?.agentCustom?.data).toContain("data:audio/wav")

  await page.reload()

  const dialogAfterReload = await openSettings(page)
  const selectAfterReload = dialogAfterReload.locator(settingsSoundsAgentSelector)
  await expect(selectAfterReload).toBeVisible()

  const triggerValue = await selectAfterReload.locator('[data-slot="select-select-trigger-value"]').textContent()
  expect(triggerValue).toContain("test-sound.wav")
})