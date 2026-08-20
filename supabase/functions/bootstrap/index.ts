import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const MEMBERS = [
  { email: 'bima@cashflow.local', name: 'Bima', color: '#10b981', icon: 'bima' },
  { email: 'aska@cashflow.local', name: 'Aska', color: '#6366f1', icon: 'aska' },
  { email: 'nanda@cashflow.local', name: 'Nanda', color: '#f59e0b', icon: 'nanda' },
]

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('setup_complete')
    .eq('id', 1)
    .maybeSingle()
  if (settings?.setup_complete) {
    return new Response(JSON.stringify({ ok: true, initialized: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { passwords?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const passwords = body.passwords ?? {}
  for (const m of MEMBERS) {
    const password = passwords[m.email]
    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: `Password untuk ${m.name} minimal 6 karakter` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  for (const m of MEMBERS) {
    const { data: user, error: uerr } = await supabase.auth.admin.createUser({
      email: m.email,
      password: passwords[m.email],
      email_confirm: true,
      user_metadata: { full_name: m.name },
    })
    if (uerr) {
      return new Response(JSON.stringify({ error: uerr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    await supabase.from('members').insert({
      id: user!.user.id,
      name: m.name,
      email: m.email,
      color: m.color,
      icon: m.icon,
    })
  }

  await supabase
    .from('app_settings')
    .upsert({ id: 1, setup_complete: true }, { onConflict: 'id' })

  return new Response(JSON.stringify({ ok: true, initialized: false }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
