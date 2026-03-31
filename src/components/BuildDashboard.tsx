import { startTransition, useDeferredValue, useEffect, useState } from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  WifiOff,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RARITY_ORDER, type RawBrawler } from "@/lib/brawlers"

const BRAWLIFY_URL = "https://api.brawlify.com/v1/brawlers"

type GearOption = {
  key: string
  name: string
  imageSrc: string
}

type ApiAbility = {
  id: string
  name: string
  imageUrl: string
}

type ApiBrawler = {
  id: string
  name: string
  imageUrl: string
  rarity: string
  gadgets: ApiAbility[]
  starPowers: ApiAbility[]
  link?: string
}

type SelectedGear = {
  key: string
  label: string
}

type BuildDraft = {
  primaryGadgetId: string | null
  useBothGadgets: boolean
  primaryStarPowerId: string | null
  alternativeStarPowerId: string | null
  primaryGears: SelectedGear[]
  alternativeGears: SelectedGear[]
}

type Props = {
  currentBuilds: RawBrawler[]
  gearOptions: GearOption[]
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: Array<{
      description?: string
      accept: Record<string, string[]>
    }>
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: string) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0

const toLookupKey = (value: string) => value.trim().toLowerCase()

const toGearKey = (value: string) =>
  value
    .trim()
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/\s+/g, "-") ?? ""

const rarityRank = (rarity: string) => {
  const rank = RARITY_ORDER.indexOf(rarity as (typeof RARITY_ORDER)[number])

  return rank === -1 ? RARITY_ORDER.length : rank
}

const parseAbilityList = (value: unknown): ApiAbility[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.name) || !isNonEmptyString(entry.imageUrl)) {
      return []
    }

    const rawId = entry.id
    const id = typeof rawId === "number" || isNonEmptyString(rawId) ? String(rawId) : entry.name

    return [
      {
        id,
        name: entry.name.trim(),
        imageUrl: entry.imageUrl.trim(),
      },
    ]
  })
}

const parseBrawlers = (payload: unknown): ApiBrawler[] => {
  if (!isRecord(payload) || !Array.isArray(payload.list)) {
    throw new Error("The document does not look like the Brawlify /v1/brawlers response.")
  }

  return payload.list
    .flatMap((entry) => {
      if (!isRecord(entry) || !isNonEmptyString(entry.name) || !isNonEmptyString(entry.imageUrl)) {
        return []
      }

      const rarity =
        isRecord(entry.rarity) && isNonEmptyString(entry.rarity.name)
          ? entry.rarity.name.trim()
          : "Unknown"
      const gadgets = parseAbilityList(entry.gadgets)
      const starPowers = parseAbilityList(entry.starPowers)

      if (gadgets.length === 0 || starPowers.length === 0) {
        return []
      }

      const rawId = entry.id
      const id = typeof rawId === "number" || isNonEmptyString(rawId) ? String(rawId) : entry.name

      return [
        {
          id,
          name: entry.name.trim(),
          imageUrl: entry.imageUrl.trim(),
          rarity,
          gadgets,
          starPowers,
          link: isNonEmptyString(entry.link) ? entry.link.trim() : undefined,
        },
      ]
    })
    .sort((left, right) => {
      const rarityComparison = rarityRank(left.rarity) - rarityRank(right.rarity)

      if (rarityComparison !== 0) {
        return rarityComparison
      }

      return left.name.localeCompare(right.name)
    })
}

const makeEmptyDraft = (): BuildDraft => ({
  primaryGadgetId: null,
  useBothGadgets: false,
  primaryStarPowerId: null,
  alternativeStarPowerId: null,
  primaryGears: [],
  alternativeGears: [],
})

const createSeedDraft = (
  brawler: ApiBrawler,
  currentBuildByName: Map<string, RawBrawler>,
  gearOptionByKey: Map<string, GearOption>
): BuildDraft => {
  const existing = currentBuildByName.get(toLookupKey(brawler.name))

  if (!existing) {
    return makeEmptyDraft()
  }

  const primaryGadgetId =
    brawler.gadgets.find((gadget) => gadget.name === existing.bestGadgetName)?.id ?? null
  const primaryStarPowerId =
    brawler.starPowers.find((starPower) => starPower.name === existing.bestStarPowerName)?.id ?? null
  const primaryGears = existing.best2GearsIcon.flatMap((icon, index) => {
    const key = toGearKey(icon)

    if (!key) {
      return []
    }

    return [
      {
        key,
        label: existing.best2Gears[index] ?? gearOptionByKey.get(key)?.name ?? key,
      },
    ]
  })
  const alternativeStarPowerId = existing.alternativeStarPower
    ? brawler.starPowers.find((starPower) => starPower.name === existing.alternativeStarPower?.name)?.id ?? null
    : null
  const alternativeGears = (existing.alternativeGears ?? []).flatMap((choice) => {
    const key = toGearKey(choice.icon)

    if (!key) {
      return []
    }

    return [
      {
        key,
        label: choice.name.trim() || (gearOptionByKey.get(key)?.name ?? key),
      },
    ]
  })

  return {
    primaryGadgetId,
    useBothGadgets:
      Boolean(existing.alternativeGadgetName) &&
      brawler.gadgets.some((gadget) => gadget.name === existing.alternativeGadgetName),
    primaryStarPowerId,
    alternativeStarPowerId:
      alternativeStarPowerId && alternativeStarPowerId !== primaryStarPowerId
        ? alternativeStarPowerId
        : null,
    primaryGears,
    alternativeGears: alternativeGears.filter(
      (gear) => !primaryGears.some((primaryGear) => primaryGear.key === gear.key)
    ),
  }
}

const getMissingFields = (brawler: ApiBrawler, draft: BuildDraft): string[] => {
  const missing: string[] = []

  if (!draft.primaryGadgetId || !brawler.gadgets.some((gadget) => gadget.id === draft.primaryGadgetId)) {
    missing.push("gadget")
  }

  if (
    !draft.primaryStarPowerId ||
    !brawler.starPowers.some((starPower) => starPower.id === draft.primaryStarPowerId)
  ) {
    missing.push("primary star power")
  }

  if (
    draft.primaryGears.length !== 2 ||
    draft.primaryGears.some((gear) => gear.label.trim().length === 0)
  ) {
    missing.push("primary 2-gear pair")
  }

  if (rarityRank(brawler.rarity) === RARITY_ORDER.length) {
    missing.push("supported rarity")
  }

  return missing
}

const buildOutputRow = (brawler: ApiBrawler, draft: BuildDraft): RawBrawler | null => {
  const missing = getMissingFields(brawler, draft)

  if (missing.length > 0) {
    return null
  }

  const primaryGadget = brawler.gadgets.find((gadget) => gadget.id === draft.primaryGadgetId)
  const primaryStarPower = brawler.starPowers.find((entry) => entry.id === draft.primaryStarPowerId)
  const rarity = brawler.rarity as RawBrawler["rarity"]

  if (!primaryGadget || !primaryStarPower) {
    return null
  }

  const alternativeStarPower =
    draft.alternativeStarPowerId && draft.alternativeStarPowerId !== primaryStarPower.id
      ? brawler.starPowers.find((entry) => entry.id === draft.alternativeStarPowerId) ?? null
      : null
  const alternativeGears = draft.alternativeGears
    .filter(
      (gear) =>
        gear.label.trim().length > 0 &&
        !draft.primaryGears.some((primaryGear) => primaryGear.key === gear.key)
    )
    .map((gear) => ({
      name: gear.label.trim(),
      icon: gear.key,
    }))

  const nextRow: RawBrawler = {
    brawlerName: brawler.name,
    bestGadgetName: primaryGadget.name,
    bestGadgetIcon: primaryGadget.imageUrl,
    bestStarPowerName: primaryStarPower.name,
    bestStarPowerIcon: primaryStarPower.imageUrl,
    best2Gears: [draft.primaryGears[0].label.trim(), draft.primaryGears[1].label.trim()],
    best2GearsIcon: [draft.primaryGears[0].key, draft.primaryGears[1].key],
    brawlerIcon: brawler.imageUrl,
    rarity,
  }

  if (draft.useBothGadgets) {
    const alternativeGadget = brawler.gadgets.find((gadget) => gadget.id !== primaryGadget.id)

    if (alternativeGadget) {
      nextRow.alternativeGadgetName = alternativeGadget.name
      nextRow.alternativeGadgetIcon = alternativeGadget.imageUrl
    }
  }

  if (alternativeStarPower) {
    nextRow.alternativeStarPower = {
      name: alternativeStarPower.name,
      icon: alternativeStarPower.imageUrl,
    }
  }

  if (alternativeGears.length > 0) {
    nextRow.alternativeGears = alternativeGears
  }

  return nextRow
}

export default function BuildDashboard({ currentBuilds, gearOptions }: Props) {
  const [brawlers, setBrawlers] = useState<ApiBrawler[]>([])
  const [drafts, setDrafts] = useState<Record<string, BuildDraft>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sourceJson, setSourceJson] = useState("")
  const [sourceMode, setSourceMode] = useState<"idle" | "loading" | "live" | "pasted" | "error">(
    "idle"
  )
  const [sourceMessage, setSourceMessage] = useState("Live Brawlify data has not loaded yet.")
  const [filter, setFilter] = useState("")
  const [copiedState, setCopiedState] = useState<"idle" | "copied" | "downloaded" | "saved">("idle")

  const deferredFilter = useDeferredValue(filter)
  const currentBuildByName = new Map(
    currentBuilds.map((build) => [toLookupKey(build.brawlerName), build] as const)
  )
  const gearOptionByKey = new Map(gearOptions.map((option) => [option.key, option] as const))

  const applyBrawlers = (nextBrawlers: ApiBrawler[], message: string, mode: "live" | "pasted") => {
    startTransition(() => {
      setBrawlers(nextBrawlers)
      setDrafts((previous) => {
        const nextDrafts: Record<string, BuildDraft> = {}

        for (const brawler of nextBrawlers) {
          nextDrafts[brawler.id] =
            previous[brawler.id] ?? createSeedDraft(brawler, currentBuildByName, gearOptionByKey)
        }

        return nextDrafts
      })
      setSelectedId((previous) => {
        if (previous && nextBrawlers.some((brawler) => brawler.id === previous)) {
          return previous
        }

        return nextBrawlers[0]?.id ?? null
      })
      setSourceMode(mode)
      setSourceMessage(message)
    })
  }

  const loadLiveData = async () => {
    setSourceMode("loading")
    setSourceMessage("Loading live brawler metadata from Brawlify...")

    try {
      const response = await fetch(BRAWLIFY_URL)

      if (!response.ok) {
        throw new Error(`Brawlify returned ${response.status}.`)
      }

      const payload = await response.json()
      const parsed = parseBrawlers(payload)

      applyBrawlers(parsed, `Loaded ${parsed.length} brawlers from the live Brawlify API.`, "live")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error."
      setSourceMode("error")
      setSourceMessage(
        `Live loading failed in this browser: ${message} Paste the API JSON below and keep going.`
      )
    }
  }

  const loadPastedData = () => {
    try {
      const parsed = parseBrawlers(JSON.parse(sourceJson))
      applyBrawlers(parsed, `Loaded ${parsed.length} brawlers from pasted Brawlify JSON.`, "pasted")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error."
      setSourceMode("error")
      setSourceMessage(`The pasted JSON could not be parsed: ${message}`)
    }
  }

  useEffect(() => {
    void loadLiveData()
  }, [])

  useEffect(() => {
    if (copiedState === "idle") {
      return
    }

    const timer = window.setTimeout(() => {
      setCopiedState("idle")
    }, 1800)

    return () => {
      window.clearTimeout(timer)
    }
  }, [copiedState])

  const visibleBrawlers = brawlers.filter((brawler) => {
    const query = deferredFilter.trim().toLowerCase()

    if (query.length === 0) {
      return true
    }

    return (
      brawler.name.toLowerCase().includes(query) ||
      brawler.rarity.toLowerCase().includes(query)
    )
  })

  const selectedBrawler = brawlers.find((brawler) => brawler.id === selectedId) ?? null
  const selectedDraft = selectedBrawler ? drafts[selectedBrawler.id] ?? makeEmptyDraft() : makeEmptyDraft()

  const outputByName = new Map(
    currentBuilds.map((build) => [toLookupKey(build.brawlerName), build] as const)
  )
  let readyCount = 0

  for (const brawler of brawlers) {
    const nextRow = buildOutputRow(brawler, drafts[brawler.id] ?? makeEmptyDraft())

    if (nextRow) {
      readyCount += 1
      outputByName.set(toLookupKey(brawler.name), nextRow)
    }
  }

  const outputRows = Array.from(outputByName.values()).sort((left, right) => {
    const rarityComparison = rarityRank(left.rarity) - rarityRank(right.rarity)

    if (rarityComparison !== 0) {
      return rarityComparison
    }

    return left.brawlerName.localeCompare(right.brawlerName)
  })
  const outputJson = JSON.stringify(outputRows, null, 2)
  const incompleteCount = brawlers.length === 0 ? 0 : brawlers.length - readyCount
  const selectedMissing = selectedBrawler ? getMissingFields(selectedBrawler, selectedDraft) : []
  const selectedOutput = selectedBrawler ? buildOutputRow(selectedBrawler, selectedDraft) : null
  const selectedAlternativeGadget =
    selectedBrawler && selectedDraft.primaryGadgetId
      ? selectedBrawler.gadgets.find((gadget) => gadget.id !== selectedDraft.primaryGadgetId) ?? null
      : null

  const updateDraft = (brawlerId: string, updater: (draft: BuildDraft) => BuildDraft) => {
    setDrafts((previous) => ({
      ...previous,
      [brawlerId]: updater(previous[brawlerId] ?? makeEmptyDraft()),
    }))
  }

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(outputJson)
      setCopiedState("copied")
    } catch {
      setCopiedState("idle")
    }
  }

  const downloadOutput = () => {
    const blob = new Blob([outputJson], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = "brawlers.json"
    link.click()
    URL.revokeObjectURL(url)
    setCopiedState("downloaded")
  }

  const saveToFile = async () => {
    const pickerWindow = window as FilePickerWindow

    if (!pickerWindow.showSaveFilePicker) {
      downloadOutput()
      return
    }

    try {
      const fileHandle = await pickerWindow.showSaveFilePicker({
        suggestedName: "brawlers.json",
        types: [
          {
            description: "JSON files",
            accept: {
              "application/json": [".json"],
            },
          },
        ],
      })
      const writable = await fileHandle.createWritable()

      await writable.write(outputJson)
      await writable.close()
      setCopiedState("saved")
    } catch {
      setCopiedState("idle")
    }
  }

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] max-md:rounded-[22px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(250,204,21,0.18),transparent_28%)]" />
        <div className="relative grid gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <p className="m-0 text-[0.78rem] font-black uppercase tracking-[0.16em] text-slate-500">
                Build Editor
              </p>
              <h1 className="m-0 text-[clamp(2rem,3.5vw,3.6rem)] leading-[0.96] font-black tracking-[-0.05em] text-slate-950">
                Pick the right build once, then export the exact JSON the site already understands.
              </h1>
              <p className="m-0 max-w-[72ch] text-[1.02rem] leading-7 text-slate-600">
                This dashboard pulls brawler names, gadgets, star powers, and icons from Brawlify,
                prefills anything already saved in your local file, and keeps incomplete edits out of
                the export until they are ready.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void loadLiveData()}>
                <RefreshCw />
                Reload Live Data
              </Button>
              <Button variant="outline" render={<a href={BRAWLIFY_URL} target="_blank" rel="noreferrer" />}>
                <ExternalLink />
                Open API
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
              <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Source
              </p>
              <p className="mt-2 mb-0 text-2xl font-black tracking-[-0.04em] text-slate-950">
                {sourceMode === "live"
                  ? "Live API"
                  : sourceMode === "pasted"
                    ? "Pasted JSON"
                    : sourceMode === "loading"
                      ? "Loading"
                      : sourceMode === "error"
                        ? "Fallback"
                        : "Waiting"}
              </p>
              <p className="mt-2 mb-0 text-sm leading-6 text-slate-600">{sourceMessage}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
              <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Ready To Export
              </p>
              <p className="mt-2 mb-0 text-2xl font-black tracking-[-0.04em] text-slate-950">
                {outputRows.length}
              </p>
              <p className="mt-2 mb-0 text-sm leading-6 text-slate-600">
                Includes your current saved entries plus any completed edits from this dashboard.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/85 p-4">
              <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Needs Attention
              </p>
              <p className="mt-2 mb-0 text-2xl font-black tracking-[-0.04em] text-slate-950">
                {incompleteCount}
              </p>
              <p className="mt-2 mb-0 text-sm leading-6 text-slate-600">
                Loaded brawlers without a complete gadget, primary star power, and default 2-gear pair yet.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-950 p-4 text-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-sky-200">
                  Paste Fallback
                </p>
                <p className="mt-1 mb-0 max-w-[72ch] text-sm leading-6 text-slate-300">
                  If live loading fails in your browser, open{" "}
                  <a className="underline decoration-slate-500 underline-offset-4" href={BRAWLIFY_URL} target="_blank" rel="noreferrer">
                    {BRAWLIFY_URL}
                  </a>{" "}
                  and paste the whole JSON response here.
                </p>
              </div>

              <Button variant="secondary" onClick={loadPastedData}>
                {sourceMode === "error" ? <WifiOff /> : <Check />}
                Use Pasted JSON
              </Button>
            </div>

            <Textarea
              value={sourceJson}
              onChange={(event) => setSourceJson(event.target.value)}
              placeholder='Paste the full {"list":[...]} response here if the live fetch is blocked.'
              className="min-h-32 border-slate-700 bg-slate-900/70 text-slate-50 placeholder:text-slate-400"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_400px]">
        <aside className="grid gap-4 self-start rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] max-md:rounded-[22px] xl:sticky xl:top-6">
          <div className="space-y-3">
            <div>
              <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                Brawlers
              </p>
              <h2 className="mt-1 mb-0 text-xl font-black tracking-[-0.04em] text-slate-950">
                Choose who you want to edit.
              </h2>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search brawler or rarity"
                className="h-11 rounded-2xl pl-9"
              />
            </div>
          </div>

          <div className="grid max-h-[72vh] gap-2 overflow-y-auto pr-1">
            {visibleBrawlers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                No brawlers matched that filter.
              </div>
            ) : (
              visibleBrawlers.map((brawler) => {
                const draft = drafts[brawler.id] ?? makeEmptyDraft()
                const isSelected = brawler.id === selectedId
                const isReady = buildOutputRow(brawler, draft) !== null
                const isSavedAlready = currentBuildByName.has(toLookupKey(brawler.name))

                return (
                  <button
                    key={brawler.id}
                    type="button"
                    onClick={() => setSelectedId(brawler.id)}
                    className={`grid grid-cols-[54px_minmax(0,1fr)] items-center gap-3 rounded-[22px] border p-3 text-left transition ${
                      isSelected
                        ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.22)]"
                        : "border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-white"
                    }`}
                  >
                    <img
                      src={brawler.imageUrl}
                      alt={`${brawler.name} icon`}
                      width={54}
                      height={54}
                      className="h-[54px] w-[54px] rounded-2xl bg-white/85 object-contain p-1.5"
                      loading="lazy"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-black">{brawler.name}</span>
                        {isSavedAlready && (
                          <Badge variant={isSelected ? "secondary" : "outline"}>Saved</Badge>
                        )}
                      </span>
                      <span
                        className={`mt-1 flex items-center gap-2 text-xs ${
                          isSelected ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        <span>{brawler.rarity}</span>
                        <span aria-hidden="true">•</span>
                        <span>{isReady ? "Ready" : "Needs picks"}</span>
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <div className="grid gap-6">
          {selectedBrawler ? (
            <>
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] max-md:rounded-[22px]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <img
                      src={selectedBrawler.imageUrl}
                      alt={`${selectedBrawler.name} icon`}
                      width={88}
                      height={88}
                      className="h-[88px] w-[88px] rounded-[24px] border border-slate-200 bg-slate-50 p-2 object-contain"
                    />
                    <div className="min-w-0">
                      <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                        Editing
                      </p>
                      <h2 className="mt-1 mb-0 text-[2rem] leading-none font-black tracking-[-0.05em] text-slate-950">
                        {selectedBrawler.name}
                      </h2>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedBrawler.rarity}</Badge>
                        {selectedOutput ? (
                          <Badge variant="secondary">Ready to export</Badge>
                        ) : (
                          <Badge variant="destructive">Incomplete</Badge>
                        )}
                        {currentBuildByName.has(toLookupKey(selectedBrawler.name)) && (
                          <Badge variant="outline">Existing local build</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedBrawler.link && (
                      <Button
                        variant="outline"
                        render={<a href={selectedBrawler.link} target="_blank" rel="noreferrer" />}
                      >
                        <ExternalLink />
                        Brawlify Page
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateDraft(selectedBrawler.id, () =>
                          createSeedDraft(selectedBrawler, currentBuildByName, gearOptionByKey)
                        )
                      }
                    >
                      <RefreshCw />
                      Reset This Brawler
                    </Button>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    Export Status
                  </p>
                  {selectedMissing.length === 0 ? (
                    <p className="mt-2 mb-0 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <Check className="size-4" />
                      This brawler is complete and will appear in the exported JSON.
                    </p>
                  ) : (
                    <p className="mt-2 mb-0 flex items-center gap-2 text-sm font-semibold text-amber-700">
                      <AlertTriangle className="size-4" />
                      Missing {selectedMissing.join(", ")} before this draft can replace or create an entry.
                    </p>
                  )}
                </div>
              </section>

              <section className="grid gap-6 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)] max-md:rounded-[22px]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                        Gadget
                      </p>
                      <h3 className="mt-1 mb-0 text-2xl font-black tracking-[-0.04em] text-slate-950">
                        Choose the main gadget.
                      </h3>
                    </div>
                    {selectedDraft.useBothGadgets && selectedAlternativeGadget && (
                      <Badge variant="secondary">Niche backup: {selectedAlternativeGadget.name}</Badge>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedBrawler.gadgets.map((gadget) => {
                      const isSelected = selectedDraft.primaryGadgetId === gadget.id

                      return (
                        <button
                          key={gadget.id}
                          type="button"
                          onClick={() =>
                            updateDraft(selectedBrawler.id, (draft) => ({
                              ...draft,
                              primaryGadgetId: gadget.id,
                            }))
                          }
                          className={`grid min-h-28 gap-3 rounded-[22px] border p-4 text-left transition ${
                            isSelected
                              ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]"
                              : "border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={gadget.imageUrl}
                              alt={`${gadget.name} icon`}
                              width={54}
                              height={54}
                              className="h-[54px] w-[54px] rounded-2xl bg-white/90 p-1.5 object-contain"
                              loading="lazy"
                            />
                            <div className="min-w-0">
                              <p className="m-0 text-lg leading-tight font-black">{gadget.name}</p>
                              <p
                                className={`mt-2 mb-0 text-sm leading-6 ${
                                  isSelected ? "text-slate-300" : "text-slate-500"
                                }`}
                              >
                                The default gadget people can safely run most of the time.
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedDraft.useBothGadgets}
                      onChange={(event) =>
                        updateDraft(selectedBrawler.id, (draft) => ({
                          ...draft,
                          useBothGadgets: event.target.checked,
                        }))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <span>
                      <span className="block font-semibold text-slate-950">Also show the niche gadget</span>
                      <span className="mt-1 block leading-6 text-slate-500">
                        Use this when the other gadget is still good in the right mode or matchup. The site
                        keeps your chosen gadget as the clear winner and presents the other one as the niche backup.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                        Star Power
                      </p>
                      <h3 className="mt-1 mb-0 text-2xl font-black tracking-[-0.04em] text-slate-950">
                        Pick the clear default star power.
                      </h3>
                    </div>
                    <Badge variant={selectedDraft.primaryStarPowerId ? "secondary" : "outline"}>
                      {selectedDraft.alternativeStarPowerId ? "1 niche backup" : "Default only"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedBrawler.starPowers.map((starPower) => {
                      const isSelected = selectedDraft.primaryStarPowerId === starPower.id

                      return (
                        <button
                          key={starPower.id}
                          type="button"
                          onClick={() =>
                            updateDraft(selectedBrawler.id, (draft) => ({
                              ...draft,
                              primaryStarPowerId: starPower.id,
                              alternativeStarPowerId:
                                draft.alternativeStarPowerId === starPower.id
                                  ? null
                                  : draft.alternativeStarPowerId,
                            }))
                          }
                          className={`grid min-h-28 gap-3 rounded-[22px] border p-4 text-left transition ${
                            isSelected
                              ? "border-amber-400 bg-amber-50 shadow-[0_10px_24px_rgba(245,158,11,0.12)]"
                              : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <img
                              src={starPower.imageUrl}
                              alt={`${starPower.name} icon`}
                              width={54}
                              height={54}
                              className="h-[54px] w-[54px] rounded-2xl bg-white p-1.5 object-contain shadow-sm"
                              loading="lazy"
                            />
                            <div className="min-w-0">
                              <p className="m-0 text-lg leading-tight font-black text-slate-950">
                                {starPower.name}
                              </p>
                              <p className="mt-2 mb-0 text-sm leading-6 text-slate-500">
                                Your default star power in the exported JSON.
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {selectedBrawler.starPowers.length > 1 && (
                    <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Niche Star Power
                        </p>
                        <p className="mt-1 mb-0 text-sm leading-6 text-slate-600">
                          Mark the other star power if it is still worth calling out on the public card.
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedBrawler.starPowers
                          .filter((starPower) => starPower.id !== selectedDraft.primaryStarPowerId)
                          .map((starPower) => {
                            const isSelected = selectedDraft.alternativeStarPowerId === starPower.id

                            return (
                              <button
                                key={starPower.id}
                                type="button"
                                onClick={() =>
                                  updateDraft(selectedBrawler.id, (draft) => ({
                                    ...draft,
                                    alternativeStarPowerId: isSelected ? null : starPower.id,
                                  }))
                                }
                                className={`grid min-h-24 gap-3 rounded-[20px] border p-4 text-left transition ${
                                  isSelected
                                    ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
                                    : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-100"
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <img
                                    src={starPower.imageUrl}
                                    alt={`${starPower.name} icon`}
                                    width={46}
                                    height={46}
                                    className="h-[46px] w-[46px] rounded-2xl bg-white p-1.5 object-contain"
                                    loading="lazy"
                                  />
                                  <div className="min-w-0">
                                    <p className="m-0 text-base leading-tight font-black">{starPower.name}</p>
                                    <p
                                      className={`mt-2 mb-0 text-sm leading-6 ${
                                        isSelected ? "text-slate-300" : "text-slate-500"
                                      }`}
                                    >
                                      Show this as a situational backup, not the default.
                                    </p>
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                        Gears
                      </p>
                      <h3 className="mt-1 mb-0 text-2xl font-black tracking-[-0.04em] text-slate-950">
                        Pick the default 2-gear pair.
                      </h3>
                    </div>
                    <Badge variant={selectedDraft.primaryGears.length === 2 ? "secondary" : "outline"}>
                      {selectedDraft.primaryGears.length}/2 selected
                    </Badge>
                  </div>

                  <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3">
                    {gearOptions.map((gear) => {
                      const isSelected = selectedDraft.primaryGears.some(
                        (selectedGear) => selectedGear.key === gear.key
                      )
                      const isFull = selectedDraft.primaryGears.length >= 2

                      return (
                        <button
                          key={gear.key}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            updateDraft(selectedBrawler.id, (draft) => {
                              const existingIndex = draft.primaryGears.findIndex(
                                (selectedGear) => selectedGear.key === gear.key
                              )

                              if (existingIndex !== -1) {
                                return {
                                  ...draft,
                                  primaryGears: draft.primaryGears.filter(
                                    (selectedGear) => selectedGear.key !== gear.key
                                  ),
                                }
                              }

                              if (draft.primaryGears.length >= 2) {
                                return draft
                              }

                              return {
                                ...draft,
                                primaryGears: [...draft.primaryGears, { key: gear.key, label: gear.name }],
                                alternativeGears: draft.alternativeGears.filter(
                                  (selectedGear) => selectedGear.key !== gear.key
                                ),
                              }
                            })
                          }
                          className={`grid justify-items-center gap-2 rounded-[22px] border px-3 py-4 text-center transition ${
                            isSelected
                              ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]"
                              : isFull
                                ? "border-slate-200 bg-slate-50 text-slate-400"
                                : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <img
                            src={gear.imageSrc}
                            alt={`${gear.name} gear icon`}
                            width={46}
                            height={46}
                            className="h-[46px] w-[46px] object-contain"
                            loading="lazy"
                          />
                          <span className="text-xs leading-5 font-bold">{gear.name}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="grid gap-3">
                    {selectedDraft.primaryGears.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
                        Select the default 2-gear pair, then tweak the labels if you want different text on the public card.
                      </div>
                    ) : (
                      selectedDraft.primaryGears.map((gear) => {
                        const option = gearOptionByKey.get(gear.key)

                        return (
                          <div
                            key={gear.key}
                            className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-3 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                          >
                            <div className="flex items-center gap-3">
                              {option && (
                                <img
                                  src={option.imageSrc}
                                  alt={`${gear.label} icon`}
                                  width={42}
                                  height={42}
                                  className="h-[42px] w-[42px] rounded-xl bg-white p-1.5 object-contain"
                                  loading="lazy"
                                />
                              )}
                              <div>
                                <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                  Default gear
                                </p>
                                <p className="mt-1 mb-0 text-sm font-semibold text-slate-950">{gear.key}</p>
                              </div>
                            </div>
                            <Input
                              value={gear.label}
                              onChange={(event) =>
                                updateDraft(selectedBrawler.id, (draft) => ({
                                  ...draft,
                                  primaryGears: draft.primaryGears.map((selectedGear) =>
                                    selectedGear.key === gear.key
                                      ? { ...selectedGear, label: event.target.value }
                                      : selectedGear
                                  ),
                                }))
                              }
                              placeholder="Label shown on the site"
                              className="h-11 rounded-2xl bg-white"
                            />
                            <Button
                              variant="ghost"
                              onClick={() =>
                                updateDraft(selectedBrawler.id, (draft) => ({
                                  ...draft,
                                  primaryGears: draft.primaryGears.filter(
                                    (selectedGear) => selectedGear.key !== gear.key
                                  ),
                                }))
                              }
                            >
                              <X />
                              Remove
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                          Niche Gear Swaps
                        </p>
                        <p className="mt-1 mb-0 text-sm leading-6 text-slate-600">
                          Add any extra gears that are still viable in specific maps or matchups.
                        </p>
                      </div>
                      <Badge variant={selectedDraft.alternativeGears.length > 0 ? "secondary" : "outline"}>
                        {selectedDraft.alternativeGears.length} selected
                      </Badge>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3">
                      {gearOptions.map((gear) => {
                        const isPrimary = selectedDraft.primaryGears.some(
                          (selectedGear) => selectedGear.key === gear.key
                        )
                        const isSelected = selectedDraft.alternativeGears.some(
                          (selectedGear) => selectedGear.key === gear.key
                        )

                        return (
                          <button
                            key={gear.key}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() =>
                              updateDraft(selectedBrawler.id, (draft) => {
                                if (draft.primaryGears.some((selectedGear) => selectedGear.key === gear.key)) {
                                  return draft
                                }

                                const existingIndex = draft.alternativeGears.findIndex(
                                  (selectedGear) => selectedGear.key === gear.key
                                )

                                if (existingIndex !== -1) {
                                  return {
                                    ...draft,
                                    alternativeGears: draft.alternativeGears.filter(
                                      (selectedGear) => selectedGear.key !== gear.key
                                    ),
                                  }
                                }

                                return {
                                  ...draft,
                                  alternativeGears: [
                                    ...draft.alternativeGears,
                                    { key: gear.key, label: gear.name },
                                  ],
                                }
                              })
                            }
                            className={`grid justify-items-center gap-2 rounded-[22px] border px-3 py-4 text-center transition ${
                              isPrimary
                                ? "border-slate-200 bg-slate-100 text-slate-400"
                                : isSelected
                                  ? "border-sky-600 bg-sky-50 text-sky-950 shadow-[0_10px_22px_rgba(14,165,233,0.14)]"
                                  : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50"
                            }`}
                          >
                            <img
                              src={gear.imageSrc}
                              alt={`${gear.name} gear icon`}
                              width={46}
                              height={46}
                              className="h-[46px] w-[46px] object-contain"
                              loading="lazy"
                            />
                            <span className="text-xs leading-5 font-bold">{gear.name}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="grid gap-3">
                      {selectedDraft.alternativeGears.length === 0 ? (
                        <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-4 py-4 text-sm leading-6 text-slate-500">
                          No niche gear swaps selected yet.
                        </div>
                      ) : (
                        selectedDraft.alternativeGears.map((gear) => {
                          const option = gearOptionByKey.get(gear.key)

                          return (
                            <div
                              key={gear.key}
                              className="grid gap-3 rounded-[22px] border border-slate-200 bg-white p-3 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                            >
                              <div className="flex items-center gap-3">
                                {option && (
                                  <img
                                    src={option.imageSrc}
                                    alt={`${gear.label} icon`}
                                    width={42}
                                    height={42}
                                    className="h-[42px] w-[42px] rounded-xl bg-slate-50 p-1.5 object-contain"
                                    loading="lazy"
                                  />
                                )}
                                <div>
                                  <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                                    Niche gear
                                  </p>
                                  <p className="mt-1 mb-0 text-sm font-semibold text-slate-950">{gear.key}</p>
                                </div>
                              </div>
                              <Input
                                value={gear.label}
                                onChange={(event) =>
                                  updateDraft(selectedBrawler.id, (draft) => ({
                                    ...draft,
                                    alternativeGears: draft.alternativeGears.map((selectedGear) =>
                                      selectedGear.key === gear.key
                                        ? { ...selectedGear, label: event.target.value }
                                        : selectedGear
                                    ),
                                  }))
                                }
                                placeholder="Label shown on the site"
                                className="h-11 rounded-2xl bg-white"
                              />
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  updateDraft(selectedBrawler.id, (draft) => ({
                                    ...draft,
                                    alternativeGears: draft.alternativeGears.filter(
                                      (selectedGear) => selectedGear.key !== gear.key
                                    ),
                                  }))
                                }
                              >
                                <X />
                                Remove
                              </Button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
              Load Brawlify data, then choose a brawler from the list.
            </section>
          )}
        </div>

        <aside className="grid gap-4 self-start rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.06)] max-md:rounded-[22px] xl:sticky xl:top-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Output
                </p>
                <h2 className="mt-1 mb-0 text-xl font-black tracking-[-0.04em] text-slate-950">
                  Ready-to-use `brawlers.json`
                </h2>
              </div>

              {selectedOutput && <Badge variant="secondary">{selectedBrawler?.name} ready</Badge>}
            </div>

            <p className="m-0 text-sm leading-6 text-slate-600">
              Complete drafts replace existing entries automatically. Incomplete edits stay out of the export,
              so you do not accidentally break the site data while working through the list.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copyOutput()}>
              <Copy />
              {copiedState === "copied" ? "Copied" : "Copy JSON"}
            </Button>
            <Button variant="outline" onClick={() => void saveToFile()}>
              <Download />
              {copiedState === "saved" ? "Saved to file" : "Save To File"}
            </Button>
            <Button variant="outline" onClick={downloadOutput}>
              <Download />
              {copiedState === "downloaded" ? "Downloaded" : "Download"}
            </Button>
          </div>

          <div className="grid gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Total exported entries</span>
              <span className="font-black text-slate-950">{outputRows.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Loaded brawlers ready</span>
              <span className="font-black text-slate-950">
                {brawlers.length === 0 ? "0" : `${readyCount}/${brawlers.length}`}
              </span>
            </div>
          </div>

          <pre className="max-h-[72vh] overflow-auto rounded-[22px] border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            <code>{outputJson}</code>
          </pre>
        </aside>
      </section>
    </div>
  )
}
