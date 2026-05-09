'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const COLORS = ['#378ADD','#7F77DD','#EF9F27','#639922','#E24B4A','#3B6D11','#854F0B','#185FA5']

export default function CreateProject() {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [desc,    setDesc]    = useState('')
  const [color,   setColor]   = useState('#378ADD')
  const [error,   setError]   = useState('')
  const [users,   setUsers]   = useState<any[]>([])
  const [members, setMembers] = useState<string[]>([])  // user ids

  useEffect(() => {
    supabase.from('Users').select('id,full_name,email').then(({ data }) => setUsers(data || []))
  }, [])

  const toggleMember = (id: string) =>
    setMembers(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Project name is required.'); return }
    const { error: err } = await supabase.from('Projects').insert({
      name: name.trim(), description: desc.trim(), color_code: color, members
    })
    if (err) { setError(err.message); return }
    router.push('/all-projects')
  }

  return (
    <AppShell title="New Project">
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="card">
          <div className="form-section">Project Details</div>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input className="form-input" placeholder="e.g. Q4 Campaign" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="What is this project about?" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Accent Color</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} type="button" style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2
                }} />
              ))}
            </div>
          </div>

          {/* Assign resources/members to project */}
          <div className="form-group">
            <label className="form-label">Assign Resources to Project</label>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 8 }}>
              These people will be available to assign to tasks within this project.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {users.map(u => {
                const sel = members.includes(u.id)
                const name = u.full_name || u.email
                const ini  = name.split(' ').map((p:string) => p[0]).join('').slice(0,2).toUpperCase()
                return (
                  <button key={u.id} type="button"
                    onClick={() => toggleMember(u.id)}
                    className={sel ? 'toggle-btn sel-owner' : 'toggle-btn'}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: sel ? '#fff3' : '#EEEDFE',
                      color: sel ? '#EAF3DE' : '#534AB7', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 9, fontWeight: 600 }}>{ini}</div>
                    {sel ? '✓ ' : ''}{name}
                  </button>
                )
              })}
            </div>
            {members.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--txt3)' }}>
                {members.length} resource{members.length !== 1 ? 's' : ''} assigned
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button className="btn" onClick={() => router.back()}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>Create Project</button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
