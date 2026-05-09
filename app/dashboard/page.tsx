'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Dashboard() {
  const router  = useRouter()
  const [tasks,    setTasks]    = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [notifs,   setNotifs]   = useState<any[]>([])
  const [me,       setMe]       = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const [t, p, n] = await Promise.all([
        supabase.from('Tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('Projects').select('*').order('created_at', { ascending: false }),
        supabase.from('Notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5),
      ])
      setTasks(t.data || [])
      setProjects(p.data || [])
      setNotifs(n.data || [])
    }
    load()
  }, [])

  const today = new Date(); today.setHours(0,0,0,0)

  const myTasks = tasks.filter(t => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || o.includes(n) || (n.length>2 && o.split(',').some((x:string)=>n.includes(x.trim())))
  })

  const total     = tasks.length
  const inProg    = tasks.filter(t=>t.status==='In Progress').length
  const completed = tasks.filter(t=>t.status==='Completed').length
  const overdue   = tasks.filter(t=>{
    if(!t.end_date||t.status==='Completed') return false
    const e=new Date(t.end_date); e.setHours(0,0,0,0); return e<today
  }).length

  const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const

  return (
    <AppShell title="Dashboard">
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(5,1fr)' }}>
        {[
          {label:'Total Tasks',   value:total,            cls:''},
          {label:'In Progress',   value:inProg,           cls:'amber'},
          {label:'Completed',     value:completed,        cls:'green'},
          {label:'Overdue',       value:overdue,          cls:'red'},
          {label:'Projects',      value:projects.length,  cls:'blue'},
        ].map(s=>(
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Pipeline kanban */}
      <div className="section-hdr"><div className="section-title">Active Pipeline</div></div>
      <div className="kanban-grid" style={{ marginBottom:24 }}>
        {STATUSES.map(status=>{
          const group = tasks.filter(t=>t.status===status)
          return (
            <div key={status}>
              <div className="col-header">{status}<span className="col-count">{group.length}</span></div>
              {group.length===0
                ? <div className="col-empty">No tasks</div>
                : group.slice(0,4).map(t=>(
                    <div key={t.id} className="task-row" onClick={()=>router.push(`/tasks/${t.id}`)}>
                      <StatusDot status={t.status}/>
                      <div className="task-name">{t.topic}</div>
                      <StatusPill status={t.status}/>
                    </div>
                  ))
              }
              {group.length>4&&<div style={{fontSize:11,color:'var(--txt3)',textAlign:'center',marginTop:4}}>+{group.length-4} more</div>}
            </div>
          )
        })}
      </div>

      {/* Bottom row */}
      <div className="two-col">
        {/* My tasks */}
        <div>
          <div className="section-hdr">
            <div className="section-title">Assigned to Me</div>
            <Link href="/my-tasks" className="btn btn-sm">View all</Link>
          </div>
          {myTasks.length===0
            ? <div style={{fontSize:13,color:'var(--txt3)'}}>No tasks assigned to you.</div>
            : myTasks.slice(0,5).map(t=>(
                <div key={t.id} className="task-row" onClick={()=>router.push(`/tasks/${t.id}`)}>
                  <StatusDot status={t.status}/>
                  <div className="task-name">{t.topic}</div>
                  <div className="task-meta"><span>{t.project_name}</span></div>
                  <StatusPill status={t.status}/>
                </div>
              ))
          }
        </div>

        {/* Projects + Notifs */}
        <div>
          <div className="section-hdr">
            <div className="section-title">Projects</div>
            <Link href="/my-projects" className="btn btn-sm">View all</Link>
          </div>
          {projects.slice(0,3).map(proj=>{
            const pt = tasks.filter(t=>t.project_name===proj.name)
            const done = pt.filter(t=>t.status==='Completed').length
            const pct  = pt.length ? Math.round(done/pt.length*100) : 0
            return (
              <div key={proj.id} className="card" style={{padding:'10px 14px',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <div className="proj-dot" style={{background:proj.color_code||'#378ADD'}}/>
                  <div style={{fontSize:13,fontWeight:500,flex:1,color:'var(--txt)'}}>{proj.name}</div>
                  <div style={{fontSize:12,color:'var(--txt3)'}}>{done}/{pt.length}</div>
                </div>
                <div className="prog-bar"><div className="prog-fill" style={{width:`${pct}%`,background:proj.color_code||'#378ADD'}}/></div>
              </div>
            )
          })}

          {notifs.length>0&&(
            <>
              <div className="section-hdr" style={{marginTop:16}}>
                <div className="section-title">Recent Notifications</div>
                <Link href="/notifications" className="btn btn-sm">View all</Link>
              </div>
              <div className="card" style={{padding:'4px 12px'}}>
                {notifs.map(n=>(
                  <div key={n.id} className="notif-item">
                    <div className="notif-dot" style={{background:n.is_read?'#ccc':'#378ADD'}}/>
                    <div className="notif-text">{n.message}</div>
                    <div className="notif-time">{n.created_at?.slice(0,10)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
