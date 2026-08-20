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

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + '!A1'
}

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

  for (const m of MEMBERS) {
    const { data: user, error: uerr } = await supabase.auth.admin.createUser({
      email: m.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: m.name },
    })
    if (uerr && !isAlreadyRegistered(uerr.message)) {
      return new Response(JSON.stringify({ error: uerr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const userId = user?.user.id ?? (await findUserId(m.email))
    if (!userId) {
      return new Response(JSON.stringify({ error: `Gagal membuat akun ${m.name}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { error: merr } = await supabase.from('members').upsert(
      { id: userId, name: m.name, email: m.email, color: m.color, icon: m.icon },
      { onConflict: 'email' },
    )
    if (merr) {
      return new Response(JSON.stringify({ error: merr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const { error: serr } = await supabase
    .from('app_settings')
    .upsert({ id: 1, setup_complete: true }, { onConflict: 'id' })
  if (serr) {
    return new Response(JSON.stringify({ error: serr.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, initialized: false }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function isAlreadyRegistered(message: string): boolean {
  return message.toLowerCase().includes('already been registered')
}

async function findUserId(email: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const match = (data?.users ?? []).find((u) => u.email === email)
  return match?.id ?? null
}
