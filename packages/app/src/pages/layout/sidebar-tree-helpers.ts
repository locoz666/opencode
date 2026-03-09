import type { Session } from "@opencode-ai/sdk/v2/client"

type Project = {
  worktree: string
  sandboxes?: string[]
  vcs?: string | null
}

export type TreeLeaf = {
  directory: string
  session: Session
}

export type TreeWorkspace = {
  directory: string
  local: boolean
  leaves: TreeLeaf[]
}

export type TreeProject<P extends Project = Project> = {
  project: P
  leaves: TreeLeaf[]
  workspaces: TreeWorkspace[]
}

const leaves = (directory: string, sessions: Record<string, Session[]>) =>
  (sessions[directory] ?? []).map((session) => ({
    directory,
    session,
  }))

export const treeProjects = <P extends Project>(args: {
  projects: P[]
  sessions: Record<string, Session[]>
  ids: (project: P) => string[]
  workspaces: (project: P) => boolean
}) =>
  args.projects.map((project) => {
    const ids = args.ids(project)
    const open = project.vcs === "git" && args.workspaces(project)
    if (!open) {
      return {
        project,
        leaves: ids.flatMap((directory) => leaves(directory, args.sessions)),
        workspaces: [],
      }
    }

    return {
      project,
      leaves: [],
      workspaces: ids.map((directory) => ({
        directory,
        local: directory === project.worktree,
        leaves: leaves(directory, args.sessions),
      })),
    }
  })
