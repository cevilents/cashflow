import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MEMBER_EMAILS = new Set([
  'bima@cashflow.local',
  'aska@cashflow.local',
  'nanda@cashflow.local',
])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = body.email?.toLowerCase()
  const password = body.password
  if (!email || !MEMBER_EMAILS.has(email)) {
    return json({ error: 'Akun tidak dikenal' }, 400)
  }
  if (!password || password.length < 6) {
    return json({ error: 'Password minimal 6 karakter' }, 400)
  }

  const { data: member } = await supabase.from('members').select('*').eq('email', email).maybeSingle()
  if (!member) {
    return json({ error: 'Akun belum disiapkan' }, 400)
  }

  const { error: uerr } = await supabase.auth.admin.updateUserById(member.id, { password })
  if (uerr) {
    return json({ error: uerr.message }, 500)
  }

  const { error: perr } = await supabase.from('members').update({ password_set: true }).eq('id', member.id)
  if (perr) {
    return json({ error: perr.message }, 500)
  }

  return json({ ok: true })
})
