import { type Session } from "@opencode-ai/sdk/v2/client"
import { Button } from "@opencode-ai/ui/button"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { Icon } from "@opencode-ai/ui/icon"
import { base64Encode } from "@opencode-ai/util/encode"
import { getFilename } from "@opencode-ai/util/path"
import { type Accessor, createMemo, For, type JSX } from "solid-js"
import { type LocalProject } from "@/context/layout"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { childMapByParent, displayName, sortedRootSessions } from "./helpers"
import { ProjectIcon, SessionItem, type SessionItemProps } from "./sidebar-items"
import { treeProjects } from "./sidebar-tree-helpers"

type Mode = "classic" | "tree"

export type SidebarTreeProps = {
  mode: Accessor<Mode>
  setMode: (mode: Mode) => void
  projects: Accessor<LocalProject[]>
  sortNow: Accessor<number>
  mobile?: boolean
  projectExpanded: (directory: string) => boolean
  setProjectExpanded: (directory: string, value: boolean) => void
  workspaceExpanded: (directory: string, local: boolean) => boolean
  setWorkspaceExpanded: (directory: string, value: boolean) => void
  workspacesEnabled: (project: LocalProject) => boolean
  workspaceIds: (project: LocalProject) => string[]
  workspaceLabel: (directory: string, branch?: string, projectId?: string) => string
  sessionProps: Omit<SessionItemProps, "session" | "slug" | "children" | "mobile" | "dense" | "popover">
}

const leaves = (
  items: { directory: string; session: Session }[],
  child: (directory: string) => Map<string, string[]>,
  sessionProps: SidebarTreeProps["sessionProps"],
  mobile?: boolean,
) => (
  <For each={items}>
    {(item) => (
      <SessionItem
        {...sessionProps}
        session={item.session}
        slug={base64Encode(item.directory)}
        children={child(item.directory)}
        mobile={mobile}
        dense
        popover={false}
      />
    )}
  </For>
)

export const SidebarTree = (props: SidebarTreeProps): JSX.Element => {
  const globalSync = useGlobalSync()
  const language = useLanguage()
  const child = (directory: string) => childMapByParent(globalSync.child(directory, { bootstrap: false })[0].session)
  const branch = (directory: string) => globalSync.child(directory, { bootstrap: false })[0].vcs?.branch
  const sessions = createMemo(() =>
    Object.fromEntries(
      props
        .projects()
        .flatMap((project) => props.workspaceIds(project))
        .map((directory) => {
          const [store] = globalSync.child(directory, { bootstrap: false })
          return [directory, sortedRootSessions(store, props.sortNow())]
        }),
    ),
  )
  const rows = createMemo(() =>
    treeProjects({
      projects: props.projects(),
      sessions: sessions(),
      ids: props.workspaceIds,
      workspaces: props.workspacesEnabled,
    }),
  )

  return (
    <div class="flex min-h-0 flex-col gap-2 px-2 py-3">
      <div class="px-2">
        <Button
          variant="ghost"
          size="small"
          data-action="sidebar-mode-toggle"
          class="w-full justify-start"
          onClick={() => props.setMode(props.mode() === "tree" ? "classic" : "tree")}
        >
          {props.mode() === "tree" ? "Classic" : "Tree"}
        </Button>
      </div>

      <div class="flex min-h-0 flex-col gap-1 overflow-y-auto no-scrollbar">
        <For each={rows()}>
          {(item) => (
            <Collapsible
              variant="ghost"
              open={props.projectExpanded(item.project.worktree)}
              onOpenChange={(open) => props.setProjectExpanded(item.project.worktree, open)}
            >
              <div class="px-2" data-component="sidebar-project-item">
                <Collapsible.Trigger
                  data-component="sidebar-project-toggle"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-raised-base-hover"
                >
                  <ProjectIcon project={item.project} class="size-7" />
                  <div class="min-w-0 grow">
                    <div class="truncate text-14-medium text-text-strong">{displayName(item.project)}</div>
                    <div class="truncate text-12-regular text-text-weak">{item.project.worktree}</div>
                  </div>
                  <div class="flex size-5 shrink-0 items-center justify-center text-icon-weak">
                    <Icon
                      name={props.projectExpanded(item.project.worktree) ? "chevron-down" : "chevron-right"}
                      size="small"
                    />
                  </div>
                </Collapsible.Trigger>
              </div>

              <Collapsible.Content>
                <div class="flex flex-col gap-1 px-2 pb-2">
                  <For each={item.workspaces}>
                    {(workspace) => (
                      <Collapsible
                        variant="ghost"
                        open={props.workspaceExpanded(workspace.directory, workspace.local)}
                        onOpenChange={(open) => props.setWorkspaceExpanded(workspace.directory, open)}
                      >
                        <div data-component="sidebar-workspace-item">
                          <Collapsible.Trigger
                            data-component="sidebar-workspace-toggle"
                            class="flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2 text-left hover:bg-surface-raised-base-hover"
                          >
                            <div class="flex min-w-0 grow items-center gap-2">
                              <Icon name="branch" size="small" class="text-icon-base" />
                              <span class="truncate text-14-medium text-text-base">
                                {workspace.local
                                  ? language.t("workspace.type.local")
                                  : language.t("workspace.type.sandbox")}
                              </span>
                              <span class="truncate text-14-regular text-text-weak">
                                {props.workspaceLabel(
                                  workspace.directory,
                                  branch(workspace.directory),
                                  item.project.id,
                                ) || getFilename(workspace.directory)}
                              </span>
                            </div>
                            <div class="flex size-5 shrink-0 items-center justify-center text-icon-weak">
                              <Icon
                                name={
                                  props.workspaceExpanded(workspace.directory, workspace.local)
                                    ? "chevron-down"
                                    : "chevron-right"
                                }
                                size="small"
                              />
                            </div>
                          </Collapsible.Trigger>
                        </div>
                        <Collapsible.Content>
                          <div class="flex flex-col gap-1 pl-6">
                            {leaves(workspace.leaves, child, props.sessionProps, props.mobile)}
                          </div>
                        </Collapsible.Content>
                      </Collapsible>
                    )}
                  </For>

                  <div class="flex flex-col gap-1 pl-6">
                    {leaves(item.leaves, child, props.sessionProps, props.mobile)}
                  </div>
                </div>
              </Collapsible.Content>
            </Collapsible>
          )}
        </For>
      </div>
    </div>
  )
}
