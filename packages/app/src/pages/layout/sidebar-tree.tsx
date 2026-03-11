import { type Session } from "@opencode-ai/sdk/v2/client"
import {
  DragDropProvider,
  DragDropSensors,
  SortableProvider,
  closestCenter,
  createSortable,
  type DragEvent as DndEvent,
} from "@thisbeyond/solid-dnd"
import { createMediaQuery } from "@solid-primitives/media"
import { Collapsible } from "@opencode-ai/ui/collapsible"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@opencode-ai/ui/tooltip"
import { base64Encode } from "@opencode-ai/util/encode"
import { getFilename } from "@opencode-ai/util/path"
import { useNavigate } from "@solidjs/router"
import { type Accessor, createMemo, For, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { type LocalProject } from "@/context/layout"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { childMapByParent, displayName, sortedRootSessions } from "./helpers"
import { SessionItem, type SessionItemProps } from "./sidebar-items"
import { treeProjects } from "./sidebar-tree-helpers"

export type SidebarTreeProps = {
  projects: Accessor<LocalProject[]>
  sortNow: Accessor<number>
  mobile?: boolean
  openProjectLabel: Accessor<string>
  openProjectKeybind: Accessor<string | undefined>
  onOpenProject: () => void
  settingsLabel: Accessor<string>
  settingsKeybind: Accessor<string | undefined>
  onOpenSettings: () => void
  helpLabel: Accessor<string>
  onOpenHelp: () => void
  projectExpanded: (directory: string) => boolean
  setProjectExpanded: (directory: string, value: boolean) => void
  workspaceExpanded: (directory: string, local: boolean) => boolean
  setWorkspaceExpanded: (directory: string, value: boolean) => void
  workspacesEnabled: (project: LocalProject) => boolean
  workspaceIds: (project: LocalProject) => string[]
  workspaceLabel: (directory: string, branch?: string, projectId?: string) => string
  workspaceBusy: (directory: string) => boolean
  workspaceEdit: (id: string) => boolean
  openWorkspaceEditor: (id: string, value: string) => void
  renameWorkspace: (directory: string, next: string, projectId?: string, branch?: string) => void
  InlineEditor: (props: {
    id: string
    value: Accessor<string>
    onSave: (next: string) => void
    class?: string
    displayClass?: string
    editing?: boolean
    stopPropagation?: boolean
    openOnDblClick?: boolean
  }) => JSX.Element
  onToggleProjectWorkspaces: (project: LocalProject) => void
  onReorderWorkspace: (root: string, from: string, to: string) => void
  onCreateWorkspace: (project: LocalProject) => void
  onResetWorkspace: (root: string, directory: string) => void
  onDeleteWorkspace: (root: string, directory: string) => void
  sessionProps: Omit<SessionItemProps, "session" | "slug" | "children" | "mobile" | "dense" | "popover">
  setScrollContainerRef?: (el: HTMLDivElement, mobile?: boolean) => void
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
  const navigate = useNavigate()
  const touch = createMediaQuery("(hover: none)")
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
    <div class="flex min-h-0 w-full min-w-0 flex-col gap-2 overflow-x-hidden px-2 py-3">
      <div class="flex min-w-0 items-center gap-1 px-2">
        <TooltipKeybind placement="bottom" title={props.openProjectLabel()} keybind={props.openProjectKeybind() ?? ""}>
          <IconButton
            icon="folder-add-left"
            variant="ghost"
            size="small"
            aria-label={props.openProjectLabel()}
            onClick={props.onOpenProject}
          />
        </TooltipKeybind>
        <TooltipKeybind placement="bottom" title={props.settingsLabel()} keybind={props.settingsKeybind() ?? ""}>
          <IconButton
            icon="settings-gear"
            variant="ghost"
            size="small"
            aria-label={props.settingsLabel()}
            onClick={props.onOpenSettings}
          />
        </TooltipKeybind>
        <Tooltip value={props.helpLabel()} placement="bottom">
          <IconButton
            icon="help"
            variant="ghost"
            size="small"
            aria-label={props.helpLabel()}
            onClick={props.onOpenHelp}
          />
        </Tooltip>
      </div>

      <div
        ref={(el) => props.setScrollContainerRef?.(el, props.mobile)}
        class="flex min-h-0 w-full min-w-0 flex-col gap-1 overflow-x-hidden overflow-y-auto no-scrollbar"
      >
        <For each={rows()}>
          {(item) => (
            <Collapsible
              variant="ghost"
              open={props.projectExpanded(item.project.worktree)}
              onOpenChange={(open) => props.setProjectExpanded(item.project.worktree, open)}
            >
              <div
                class="w-full min-w-0 px-2"
                data-component="sidebar-project-item"
                data-project={base64Encode(item.project.worktree)}
              >
                <div class="flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-md px-2 py-2 hover:bg-surface-raised-base-hover">
                  <Collapsible.Trigger
                    data-component="sidebar-project-toggle"
                    class="flex min-w-0 grow items-center overflow-hidden text-left"
                  >
                    <div class="min-w-0 grow overflow-hidden">
                      <div class="truncate text-14-medium text-text-strong">{displayName(item.project)}</div>
                      <div class="truncate text-12-regular text-text-weak">{item.project.worktree}</div>
                    </div>
                  </Collapsible.Trigger>
                  <div class="relative z-10 flex shrink-0 items-center gap-1">
                    <Tooltip
                      value={
                        props.workspacesEnabled(item.project)
                          ? language.t("workspace.new")
                          : language.t("command.session.new")
                      }
                      placement="top"
                    >
                      <IconButton
                        icon="plus-small"
                        variant="ghost"
                        size="small"
                        class="size-6 rounded-md"
                        data-action={
                          props.workspacesEnabled(item.project) ? "project-new-workspace" : "project-new-session"
                        }
                        data-project={base64Encode(item.project.worktree)}
                        aria-label={
                          props.workspacesEnabled(item.project)
                            ? language.t("workspace.new")
                            : language.t("command.session.new")
                        }
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          if (props.workspacesEnabled(item.project)) {
                            props.onCreateWorkspace(item.project)
                          } else {
                            navigate(`/${base64Encode(item.project.worktree)}/session`)
                          }
                        }}
                      />
                    </Tooltip>
                    <Tooltip
                      value={
                        props.workspacesEnabled(item.project)
                          ? language.t("sidebar.workspaces.disable")
                          : language.t("sidebar.workspaces.enable")
                      }
                      placement="top"
                    >
                      <IconButton
                        icon="branch"
                        variant="ghost"
                        size="small"
                        class="size-6 rounded-md"
                        classList={{
                          "text-icon-base": props.workspacesEnabled(item.project),
                          "text-icon-weak": !props.workspacesEnabled(item.project),
                        }}
                        data-action="project-workspaces-toggle"
                        data-project={base64Encode(item.project.worktree)}
                        aria-label={
                          props.workspacesEnabled(item.project)
                            ? language.t("sidebar.workspaces.disable")
                            : language.t("sidebar.workspaces.enable")
                        }
                        disabled={item.project.vcs !== "git" && !props.workspacesEnabled(item.project)}
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          props.onToggleProjectWorkspaces(item.project)
                        }}
                      />
                    </Tooltip>
                  </div>
                  <Collapsible.Trigger
                    data-component="sidebar-project-toggle"
                    class="flex size-6 shrink-0 items-center justify-center rounded-md text-icon-weak hover:bg-surface-raised-base-hover"
                  >
                    <Icon
                      name={props.projectExpanded(item.project.worktree) ? "chevron-down" : "chevron-right"}
                      size="small"
                    />
                  </Collapsible.Trigger>
                </div>
              </div>

              <Collapsible.Content>
                <div class="flex w-full min-w-0 flex-col gap-1 px-2 pb-2">
                  <DragDropProvider
                    collisionDetector={closestCenter}
                    onDragOver={(event: DndEvent) => {
                      const { draggable, droppable } = event
                      if (!draggable || !droppable) return
                      props.onReorderWorkspace(item.project.worktree, draggable.id.toString(), droppable.id.toString())
                    }}
                  >
                    <DragDropSensors />
                    <SortableProvider ids={item.workspaces.map((workspace) => workspace.directory)}>
                      <For each={item.workspaces}>
                        {(workspace) => {
                          const sortable = createSortable(workspace.directory)
                          const [menu, setMenu] = createStore({
                            open: false,
                            rename: false,
                          })
                          const id = `workspace:${workspace.directory}`
                          const busy = () => props.workspaceBusy(workspace.directory)
                          const editing = () => props.workspaceEdit(id)
                          const branchName = () => branch(workspace.directory)
                          const label = () =>
                            props.workspaceLabel(workspace.directory, branchName(), item.project.id) ||
                            getFilename(workspace.directory)

                          return (
                            <div
                              // @ts-ignore
                              use:sortable
                              classList={{
                                "opacity-30": sortable.isActiveDraggable,
                              }}
                            >
                              <Collapsible
                                variant="ghost"
                                open={props.workspaceExpanded(workspace.directory, workspace.local)}
                                onOpenChange={(open) => props.setWorkspaceExpanded(workspace.directory, open)}
                              >
                                <div
                                  data-component="sidebar-workspace-item"
                                  data-workspace={base64Encode(workspace.directory)}
                                  class="group/workspace relative"
                                >
                                  <Collapsible.Trigger
                                    data-component="sidebar-workspace-toggle"
                                    class="flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md py-1.5 pl-9 pr-16 text-left hover:bg-surface-raised-base-hover"
                                  >
                                    <div class="flex min-w-0 grow items-center gap-2">
                                      <span class="shrink-0 truncate text-14-medium text-text-base">
                                        {workspace.local
                                          ? language.t("workspace.type.local")
                                          : language.t("workspace.type.sandbox")}
                                      </span>
                                      <props.InlineEditor
                                        id={id}
                                        value={label}
                                        onSave={(next) => {
                                          const trimmed = next.trim()
                                          if (!trimmed) return
                                          props.renameWorkspace(
                                            workspace.directory,
                                            trimmed,
                                            item.project.id,
                                            branchName(),
                                          )
                                        }}
                                        class="min-w-0 flex-1 truncate text-14-regular text-text-weak"
                                        displayClass="min-w-0 flex-1 truncate text-14-regular text-text-weak"
                                        editing={editing()}
                                        stopPropagation={false}
                                        openOnDblClick={false}
                                      />
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
                                  <div
                                    class="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 transition-opacity pointer-events-auto"
                                    classList={{
                                      "opacity-100": touch() || menu.open,
                                      "opacity-0 group-hover/workspace:opacity-100 group-focus-within/workspace:opacity-100":
                                        !touch() && !menu.open,
                                    }}
                                  >
                                    <DropdownMenu open={menu.open} onOpenChange={(open) => setMenu("open", open)}>
                                      <Tooltip value={language.t("common.moreOptions")} placement="top">
                                        <DropdownMenu.Trigger
                                          as={IconButton}
                                          icon="dot-grid"
                                          variant="ghost"
                                          size="small"
                                          class="size-6 rounded-md"
                                          data-action="workspace-menu"
                                          data-workspace={base64Encode(workspace.directory)}
                                          aria-label={language.t("common.moreOptions")}
                                        />
                                      </Tooltip>
                                      <DropdownMenu.Portal>
                                        <DropdownMenu.Content
                                          onCloseAutoFocus={(event) => {
                                            if (!menu.rename) return
                                            event.preventDefault()
                                            setMenu("rename", false)
                                            props.openWorkspaceEditor(id, label())
                                          }}
                                        >
                                          <DropdownMenu.Item
                                            disabled={workspace.local}
                                            onSelect={() => {
                                              setMenu("rename", true)
                                              setMenu("open", false)
                                            }}
                                          >
                                            <DropdownMenu.ItemLabel>
                                              {language.t("common.rename")}
                                            </DropdownMenu.ItemLabel>
                                          </DropdownMenu.Item>
                                          <DropdownMenu.Item
                                            disabled={workspace.local || busy()}
                                            onSelect={() =>
                                              props.onResetWorkspace(item.project.worktree, workspace.directory)
                                            }
                                          >
                                            <DropdownMenu.ItemLabel>
                                              {language.t("common.reset")}
                                            </DropdownMenu.ItemLabel>
                                          </DropdownMenu.Item>
                                          <DropdownMenu.Item
                                            disabled={workspace.local || busy()}
                                            onSelect={() =>
                                              props.onDeleteWorkspace(item.project.worktree, workspace.directory)
                                            }
                                          >
                                            <DropdownMenu.ItemLabel>
                                              {language.t("common.delete")}
                                            </DropdownMenu.ItemLabel>
                                          </DropdownMenu.Item>
                                        </DropdownMenu.Content>
                                      </DropdownMenu.Portal>
                                    </DropdownMenu>
                                    <Tooltip value={language.t("command.session.new")} placement="top">
                                      <IconButton
                                        icon="plus-small"
                                        variant="ghost"
                                        size="small"
                                        class="size-6 rounded-md"
                                        data-action="workspace-new-session"
                                        data-workspace={base64Encode(workspace.directory)}
                                        aria-label={language.t("command.session.new")}
                                        onClick={(event) => {
                                          event.preventDefault()
                                          event.stopPropagation()
                                          navigate(`/${base64Encode(workspace.directory)}/session`)
                                        }}
                                      />
                                    </Tooltip>
                                  </div>
                                </div>
                                <Collapsible.Content>
                                  <div class="flex w-full min-w-0 flex-col gap-1 pl-6">
                                    {leaves(workspace.leaves, child, props.sessionProps, props.mobile)}
                                  </div>
                                </Collapsible.Content>
                              </Collapsible>
                            </div>
                          )
                        }}
                      </For>
                    </SortableProvider>
                  </DragDropProvider>

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
