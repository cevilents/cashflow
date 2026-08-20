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

const MEMBERS = [
  { email: 'bima@cashflow.local', name: 'Bima', color: '#10b981', icon: 'bima' },
  { email: 'aska@cashflow.local', name: 'Aska', color: '#6366f1', icon: 'aska' },
  { email: 'nanda@cashflow.local', name: 'Nanda', color: '#f59e0b', icon: 'nanda' },
]

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + '!A1'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const { data: settings } = await supabase
    .from('app_settings')
    .select('setup_complete')
    .eq('id', 1)
    .maybeSingle()
  if (settings?.setup_complete) {
    return json({ ok: true, initialized: true })
  }

  for (const m of MEMBERS) {
    const { data: user, error: uerr } = await supabase.auth.admin.createUser({
      email: m.email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: { full_name: m.name },
    })
    if (uerr && !isAlreadyRegistered(uerr.message)) {
      return json({ error: uerr.message }, 500)
    }
    const userId = user?.user.id ?? (await findUserId(m.email))
    if (!userId) {
      return json({ error: `Gagal membuat akun ${m.name}` }, 500)
    }
    const { error: merr } = await supabase.from('members').upsert(
      { id: userId, name: m.name, email: m.email, color: m.color, icon: m.icon },
      { onConflict: 'email' },
    )
    if (merr) {
      return json({ error: merr.message }, 500)
    }
  }

  const { error: serr } = await supabase
    .from('app_settings')
    .upsert({ id: 1, setup_complete: true }, { onConflict: 'id' })
  if (serr) {
    return json({ error: serr.message }, 500)
  }

  return json({ ok: true, initialized: false })
})

function isAlreadyRegistered(message: string): boolean {
  return message.toLowerCase().includes('already been registered')
}

async function findUserId(email: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const match = (data?.users ?? []).find((u) => u.email === email)
  return match?.id ?? null
}
