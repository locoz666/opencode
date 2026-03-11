import { describe, expect, test } from "bun:test"
import { getSessionWidthClasses } from "./session-width"

describe("getSessionWidthClasses", () => {
  test("returns current desktop caps for narrow mode", () => {
    expect(getSessionWidthClasses("narrow")).toEqual({
      centered: true,
      maxWidthClasses: "md:max-w-[500px] 2xl:max-w-[700px]",
      marginClasses: "md:mx-auto",
    })
  })

  test("returns doubled caps for wide mode", () => {
    expect(getSessionWidthClasses("wide")).toEqual({
      centered: true,
      maxWidthClasses: "md:max-w-[1000px] 2xl:max-w-[1400px]",
      marginClasses: "md:mx-auto",
    })
  })

  test("disables centered rail caps for auto mode", () => {
    expect(getSessionWidthClasses("auto")).toEqual({
      centered: false,
      maxWidthClasses: "",
      marginClasses: "",
    })
  })
})
