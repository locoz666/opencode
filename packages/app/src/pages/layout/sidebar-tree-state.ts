type Mode = "classic" | "tree"

type Project = {
  worktree: string
  sandboxes?: string[]
}

const owns = (dir: string, project: Project) => project.worktree === dir || project.sandboxes?.includes(dir) === true

export const routeAncestors = (mode: Mode, root: string, dir: string, workspaces: boolean) => {
  if (mode !== "tree") {
    return {
      project: undefined,
      workspace: undefined,
    }
  }

  return {
    project: root,
    workspace: workspaces ? dir : undefined,
  }
}

export const visibleDirs = <P extends Project>(args: {
  mode: Mode
  projects: P[]
  project?: P
  dir: string
  projectExpanded: Record<string, boolean>
  workspaceExpanded: Record<string, boolean>
  ids: (project: P) => string[]
  workspaces: (project: P) => boolean
}) => {
  if (args.mode !== "tree") {
    const project = args.project
    if (!project) return [] as string[]
    if (!args.workspaces(project)) return [project.worktree]
    return args.ids(project).filter((dir) => {
      const open = args.workspaceExpanded[dir] ?? dir === project.worktree
      return open || dir === args.dir
    })
  }

  return args.projects.flatMap((project) => {
    const open = args.projectExpanded[project.worktree] ?? true
    if (!open && !owns(args.dir, project)) return []
    if (!args.workspaces(project)) return args.ids(project)
    return args.ids(project).filter((dir) => {
      const open = args.workspaceExpanded[dir] ?? dir === project.worktree
      return open || dir === args.dir
    })
  })
}

export const eagerDirs = <P extends Project>(args: {
  mode: Mode
  projects: P[]
  project?: P
  dir: string
  projectExpanded: Record<string, boolean>
  workspaceExpanded: Record<string, boolean>
  ids: (project: P) => string[]
  workspaces: (project: P) => boolean
}) => {
  if (args.mode !== "tree") {
    return visibleDirs(args)
  }

  return args.projects.flatMap((project) => {
    const dirs = args.ids(project)
    const projectOpen = args.projectExpanded[project.worktree] === true
    const projectActive = owns(args.dir, project)
    const workspaceOpen = dirs.some((dir) => args.workspaceExpanded[dir] === true)
    if (!projectOpen && !projectActive && !workspaceOpen) return []

    if (!args.workspaces(project)) {
      if (projectOpen || projectActive) return dirs
      return []
    }

    return dirs.filter((dir) => {
      if (dir === args.dir) return true
      if (args.workspaceExpanded[dir] === true) return true
      return dir === project.worktree && projectOpen
    })
  })
}
