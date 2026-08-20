import { useAuth } from './useAuth'
import { useMembers } from './useMembers'
import type { Member } from '../lib/members'

export function useCurrentMember(): Member | null {
  const { user } = useAuth()
  const { data: members } = useMembers()
  if (!user?.id || !members) return null
  return members.find((m) => m.id === user.id) ?? null
}

export function useIsOwnData(userId: string | undefined): boolean {
  const current = useCurrentMember()
  if (!userId) return false
  return current?.id === userId
}

export function useReadOnly(userId: string | undefined): boolean {
  return !useIsOwnData(userId)
}
