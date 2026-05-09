'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { Trash2, KeyRound } from 'lucide-react'

const ROLES = ['Admin','Manager','Team Member']

export default function AdminUsers() {
  const [users,    setUsers]    = useState<any[]>([])
  const [myId,     setMyId]     = useState('')
  const [myRole,   setMyRole]   = useState('')
  const [saving,   setSaving]   = useState<string|null>(null)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [msg,      setMsg]      = useState('')

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setMyId(session?.user.id||'')
      const { data: u } = await supabase.from('Users').select('role').eq('id', session?.user.id).single()
      setMyRole(u?.role||'')
      const { data } = await supabase.from('Users').select('*').order('full_name')
      setUsers(data||[])
    }
    load()
  },[])

  const updateRole = async (id:string, role:string) => {
    setSaving(id)
    await supabase.from('Users').update({role}).eq('id',id)
    setUsers(prev=>prev.map(u=>u.id===id?{...u,role}:u))
    setSaving(null)
  }

  const deleteUser = async (user: any) => {
    if (user.id===myId) { setMsg("You can't delete yourself."); return }
    if (!confirm(`Remove "${user.full_name||user.email}"?`)) return
    setDeleting(user.id)
    await supabase.from('Users').delete().eq('id', user.id)
    setUsers(prev=>prev.filter(u=>u.id!==user.id))
    setMsg(`"${user.full_name||user.email}" removed.`)
    setDeleting(null)
  }

  const resetPassword = async (user: any) => {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset`
    })
    setMsg(error ? `Error: ${error.message}` : `Reset email sent to ${user.email}`)
  }

  const ini = (n:string) => { const p=(n||'??').split(' '); return p.length>=2?(p[0][0]+p[p.length-1][0]).toUpperCase():n.slice(0,2).toUpperCase() }

  if (myRole&&myRole!=='Admin') return <AppShell title="User Management"><div className="alert alert-error">Admin only.</div></AppShell>

  return (
    <AppShell title="User Management">
      {msg&&<div className="alert alert-success" style={{display:'flex',justifyContent:'space-between'}}>{msg}<button onClick={()=>setMsg('')} style={{background:'none',border:'none',cursor:'pointer'}}>×</button></div>}
      <div style={{fontSize:12,color:'var(--txt3)',marginBottom:16}}>{users.length} user{users.length!==1?'s':''}</div>

      <div className="card" style={{padding:0}}>
        {users.map((user,i)=>(
          <div key={user.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderBottom:i<users.length-1?'0.5px solid var(--brd)':'none'}}>
            <div className="avatar" style={{width:38,height:38,fontSize:13}}>{ini(user.full_name||user.email||'?')}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500,color:'var(--txt)'}}>{user.full_name||'Unknown'}{user.id===myId&&<span style={{fontSize:10,color:'var(--txt3)',marginLeft:6}}>(you)</span>}</div>
              <div style={{fontSize:12,color:'var(--txt3)'}}>{user.email}</div>
            </div>
            <span className={`pill ${user.role==='Admin'?'pill-c':user.role==='Manager'?'pill-ip':'pill-ns'}`}>{user.role}</span>
            <select className="form-select" style={{width:140}} value={user.role} disabled={user.id===myId||saving===user.id}
              onChange={e=>updateRole(user.id,e.target.value)}>
              {ROLES.map(r=><option key={r}>{r}</option>)}
            </select>
            <button className="btn btn-sm" onClick={()=>resetPassword(user)} title="Send password reset" style={{flexShrink:0}}>
              <KeyRound size={12}/> Reset
            </button>
            {user.id!==myId&&(
              <button onClick={()=>deleteUser(user)} disabled={deleting===user.id}
                style={{background:'none',border:'none',cursor:'pointer',color:'#cc3333',display:'flex',padding:4,opacity:deleting===user.id?0.5:1}}>
                <Trash2 size={14}/>
              </button>
            )}
          </div>
        ))}
      </div>
    </AppShell>
  )
}
