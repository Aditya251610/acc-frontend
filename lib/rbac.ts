export type WorkspaceRole = string

function normalize(role: WorkspaceRole | null | undefined): string {
  return String(role ?? "").trim().toUpperCase()
}

export function canEditContent(role: WorkspaceRole | null | undefined): boolean {
  const r = normalize(role)
  return r === "OWNER" || r === "ADMIN" || r === "EDITOR"
}

export function canDeleteContent(role: WorkspaceRole | null | undefined): boolean {
  const r = normalize(role)
  return r === "OWNER" || r === "ADMIN"
}

export function canManageMembers(role: WorkspaceRole | null | undefined): boolean {
  const r = normalize(role)
  return r === "OWNER" || r === "ADMIN"
}

export function canAssignOwner(role: WorkspaceRole | null | undefined): boolean {
  return normalize(role) === "OWNER"
}

export function canDeleteComment(opts: {
  role: WorkspaceRole | null | undefined
  isAuthor: boolean
}): boolean {
  if (opts.isAuthor) return true
  return canDeleteContent(opts.role)
}
