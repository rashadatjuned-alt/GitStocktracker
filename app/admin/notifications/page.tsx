'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { Send, Trash2 } from 'lucide-react'

export default function AdminNotifications() {
  const [users,   setUsers]   = useState<any[]>([])
  const [notifs,  setNotifs]  = useState<any[]>([])
  const [myRole,  setMyRole]  = useState('')
  const [msg,     setMsg]     = useState('')
  const [target,  setTarget]  = useState('all')
  const [success, setSuccess] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: u } = await supabase.from('Users').select('role').eq('id', session?.user.id).single()
      setMyRole(u?.role||'')
      const [us, ns] = await Promise.all([
        supabase.from('Users').select('*').order('full_name'),
        supabase.from('Notifications').select('*').order('created_at', { ascending:false }).limit(50),
      ])
      setUsers(us.data||[])
      setNotifs(ns.data||[])
    }
    load()
  },[])

  const sendNotification = async () => {
    if (!msg.trim()) return
    setSending(true)
    const targets = target==='all' ? users : users.filter(u=>u.id===target)
    for (const u of targets) {
      await supabase.from('Notifications').insert({ user_id:u.id, message:msg.trim(), is_read:false })
    }
    setSuccess(`Notification sent to ${targets.length} user${targets.length!==1?'s':''}!`)
    setMsg('')
    // Refresh
    const { data } = await supabase.from('Notifications').select('*').order('created_at',{ascending:false}).limit(50)
    setNotifs(data||[])
    setSending(false)
    setTimeout(()=>setSuccess(''),3000)
  }

  const deleteNotif = async (id: string) => {
    await supabase.from('Notifications').delete().eq('id', id)
    setNotifs(prev=>prev.filter(n=>n.id!==id))
  }

  if (myRole&&myRole!=='Admin') return <AppShell title="Notification Management"><div className="alert alert-error">Admin only.</div></AppShell>

  return (
    <AppShell title="Notification Management">
      {success&&<div className="alert alert-success">{success}</div>}

      {/* Send notification */}
      <div className="card">
        <div className="form-section">Send Notification</div>
        <div className="form-group">
          <label className="form-label">Send To</label>
          <select className="form-select" value={target} onChange={e=>setTarget(e.target.value)}>
            <option value="all">All Users ({users.length})</option>
            {users.map(u=><option key={u.id} value={u.id}>{u.full_name||u.email}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-textarea" placeholder="Type your notification message..." value={msg} onChange={e=>setMsg(e.target.value)}/>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <button className="btn btn-primary" onClick={sendNotification} disabled={sending||!msg.trim()}>
            <Send size={13}/> {sending?'Sending...':'Send Notification'}
          </button>
        </div>
      </div>

      {/* History */}
      <div style={{fontSize:14,fontWeight:500,marginBottom:12,color:'var(--txt)'}}>Recent Notifications ({notifs.length})</div>
      <div className="card" style={{padding:0}}>
        {notifs.length===0&&<div style={{padding:16,fontSize:13,color:'var(--txt3)'}}>No notifications sent yet.</div>}
        {notifs.map((n,i)=>{
          const user = users.find(u=>u.id===n.user_id)
          return (
            <div key={n.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'10px 16px',borderBottom:i<notifs.length-1?'0.5px solid var(--brd)':'none'}}>
              <div className="notif-dot" style={{background:n.is_read?'#ccc':'#378ADD',marginTop:5}}/>
              <div style={{flex:1}}>
                <div style={{fontSize:12,color:'var(--txt3)',marginBottom:2}}>{user?.full_name||user?.email||'Unknown'} · {n.created_at?.slice(0,10)}</div>
                <div style={{fontSize:13,color:'var(--txt)'}}>{n.message}</div>
              </div>
              <span className={`pill ${n.is_read?'pill-c':'pill-ip'}`} style={{fontSize:10}}>{n.is_read?'Read':'Unread'}</span>
              <button onClick={()=>deleteNotif(n.id)} style={{background:'none',border:'none',cursor:'pointer',color:'#cc3333',display:'flex',padding:4}}>
                <Trash2 size={13}/>
              </button>
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
