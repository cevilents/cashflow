import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const MEMBER_EMAILS = new Set([
  'bima@cashflow.local',
  'aska@cashflow.local',
  'nanda@cashflow.local',
])

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const email = body.email?.toLowerCase()
  const password = body.password
  if (!email || !MEMBER_EMAILS.has(email)) {
    return new Response(JSON.stringify({ error: 'Akun tidak dikenal' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!password || password.length < 6) {
    return new Response(JSON.stringify({ error: 'Password minimal 6 karakter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: member } = await supabase.from('members').select('*').eq('email', email).maybeSingle()
  if (!member) {
    return new Response(JSON.stringify({ error: 'Akun belum disiapkan' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error: uerr } = await supabase.auth.admin.updateUserById(member.id, { password })
  if (uerr) {
    return new Response(JSON.stringify({ error: uerr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error: perr } = await supabase.from('members').update({ password_set: true }).eq('id', member.id)
  if (perr) {
    return new Response(JSON.stringify({ error: perr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
