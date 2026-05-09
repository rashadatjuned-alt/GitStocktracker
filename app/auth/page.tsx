'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<'login'|'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [fullName, setName]   = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.push('/dashboard')
    setLoading(false)
  }

  const handleRegister = async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('Users').insert({
        id: data.user.id, email, full_name: fullName, role: 'Team Member'
      })
    }
    setError(''); alert('Account created! Please sign in.')
    setTab('login')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg-tertiary)'
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            ⬛ ConOps Tasker
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Team Task & Project Manager
          </div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', marginBottom: 20 }}>
            {(['login','register'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '8px 0', background: 'none', border: 'none',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                fontWeight: tab === t ? 500 : 400,
                borderBottom: tab === t ? '2px solid var(--text-primary)' : '2px solid transparent',
                marginBottom: -1
              }}>
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" placeholder="Jane Smith" value={fullName} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" placeholder="••••••••" value={password} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (tab === 'login' ? handleLogin() : handleRegister())} />
          </div>
          <button
            className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            onClick={tab === 'login' ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
