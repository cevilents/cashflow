export interface MemberSlot {
  email: string
  name: string
  color: string
  icon: string
}

export const MEMBER_SLOTS: MemberSlot[] = [
  { email: 'bima@cashflow.local', name: 'Bima', color: '#10b981', icon: 'bima' },
  { email: 'aska@cashflow.local', name: 'Aska', color: '#6366f1', icon: 'aska' },
  { email: 'nanda@cashflow.local', name: 'Nanda', color: '#f59e0b', icon: 'nanda' },
]

export function getMemberByEmail(email: string | undefined): MemberSlot | null {
  if (!email) return null
  return MEMBER_SLOTS.find((m) => m.email === email) ?? null
}

export interface Member {
  id: string
  name: string
  email: string
  color: string
  icon: string
}

export function getMemberById(id: string | undefined, members: Member[]): Member | undefined {
  if (!id) return undefined
  return members.find((m) => m.id === id)
}

export function memberInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}
