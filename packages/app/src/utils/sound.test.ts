import { describe, expect, test } from "bun:test"
import { resolveSound, SOUND_OPTIONS, soundSrc } from "./sound"

describe("resolveSound", () => {
  test("keeps preset ids compatible", () => {
    const opt = SOUND_OPTIONS.find((item) => item.id === "staplebops-01")

    expect(resolveSound("staplebops-01")).toEqual(opt)
    expect(soundSrc("staplebops-01")).toBe(opt?.src)
  })

  test("resolves custom sounds from metadata", () => {
    expect(
      resolveSound("custom", {
        name: "My sound",
        data: "data:audio/aac;base64,Zm9v",
      }),
    ).toEqual({
      id: "custom",
      src: "data:audio/aac;base64,Zm9v",
      name: "My sound",
      data: "data:audio/aac;base64,Zm9v",
    })
  })

  test("returns undefined when custom metadata is missing", () => {
    expect(resolveSound("custom")).toBeUndefined()
    expect(resolveSound("custom", { name: "My sound", data: "" })).toBeUndefined()
    expect(resolveSound("custom", { name: "", data: "data:audio/aac;base64,Zm9v" })).toBeUndefined()
    expect(soundSrc("none")).toBeUndefined()
  })
})
