export function defaultPageState() {
  return {
    lastProjectSession: {} as { [directory: string]: { directory: string; id: string; at: number } },
    activeWorkspace: undefined as string | undefined,
    projectExpanded: {} as Record<string, boolean>,
    workspaceOrder: {} as Record<string, string[]>,
    workspaceName: {} as Record<string, string>,
    workspaceBranchName: {} as Record<string, Record<string, string>>,
    workspaceExpanded: {} as Record<string, boolean>,
    gettingStartedDismissed: false,
  }
}

export const projectOpenState = (expanded: Record<string, boolean>, directory: string) => expanded[directory] ?? true
