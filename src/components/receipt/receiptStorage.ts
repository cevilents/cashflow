import { supabase } from '../../lib/supabase'

export async function uploadReceipt(file: File, userId: string, transactionId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${transactionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function removeReceipt(path: string): Promise<void> {
  const { error } = await supabase.storage.from('receipts').remove([path])
  if (error) throw error
}

export async function receiptUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
