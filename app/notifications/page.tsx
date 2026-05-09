'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'

export default function Notifications() {
  const [notifs, setNotifs] = useState<any[]>([])
  const [uid,    setUid]    = useState('')

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUid(session.user.id)
      const { data } = await supabase.from('Notifications').select('*').eq('user_id', session.user.id).order('created_at',{ascending:false})
      setNotifs(data||[])
    }
    load()
  },[])

  const markRead = async (id:string) => {
    await supabase.from('Notifications').update({is_read:true}).eq('id',id)
    setNotifs(prev=>prev.map(n=>n.id===id?{...n,is_read:true}:n))
  }
  const markAll = async () => {
    await supabase.from('Notifications').update({is_read:true}).eq('user_id',uid).eq('is_read',false)
    setNotifs(prev=>prev.map(n=>({...n,is_read:true})))
  }

  const unread = notifs.filter(n=>!n.is_read)
  const read   = notifs.filter(n=>n.is_read)

  const Section = ({label,items}:{label:string;items:any[]}) => {
    if (!items.length) return null
    return (
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--txt3)',marginBottom:8}}>
          {label} <span style={{background:'var(--bg2)',color:'var(--txt3)',fontSize:10,padding:'1px 6px',borderRadius:10,marginLeft:4}}>{items.length}</span>
        </div>
        <div className="card" style={{padding:'4px 12px'}}>
          {items.map(n=>(
            <div key={n.id} className="notif-item">
              <div className="notif-dot" style={{background:n.is_read?'#ccc':'#378ADD'}}/>
              <div className="notif-text" style={{fontWeight:n.is_read?400:500}}>{n.message}</div>
              <div className="notif-time">{n.created_at?.slice(0,10)}</div>
              {!n.is_read&&<button className="btn btn-sm" onClick={()=>markRead(n.id)}>✓</button>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <AppShell title="Notifications">
      {unread.length>0&&(
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
          <button className="btn btn-sm" onClick={markAll}>Mark all read</button>
        </div>
      )}
      {notifs.length===0&&<div className="empty-state"><div style={{fontSize:32}}>🔔</div><div style={{marginTop:8}}>No notifications.</div></div>}
      <Section label="Unread" items={unread}/>
      <Section label="Earlier" items={read}/>
    </AppShell>
  )
}
