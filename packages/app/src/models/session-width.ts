import type { SessionWidthMode } from "@/context/settings"

const WIDTH_CONFIG = {
  narrow: {
    md: 500,
    "2xl": 700,
  },
  wide: {
    md: 1000,
    "2xl": 1400,
  },
} as const

export type WidthClassConfig = {
  centered: boolean
  maxWidthClasses: string
  marginClasses: string
}

export function getSessionWidthClasses(mode: SessionWidthMode): WidthClassConfig {
  if (mode === "auto") {
    return {
      centered: false,
      maxWidthClasses: "",
      marginClasses: "",
    }
  }

  const width = WIDTH_CONFIG[mode]
  return {
    centered: true,
    maxWidthClasses: `md:max-w-[${width.md}px] 2xl:max-w-[${width["2xl"]}px]`,
    marginClasses: "md:mx-auto",
  }
}
