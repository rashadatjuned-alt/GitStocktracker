'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Clock, CheckCircle2, RotateCcw, Folders, Users, TrendingUp, Calendar } from 'lucide-react'

const TYPES = ['One-time','Weekly','Monthly','Quarterly','Semi-annually','Annually']
const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const

export default function Dashboard() {
  const router  = useRouter()
  const [tasks,    setTasks]    = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [users,    setUsers]    = useState<any[]>([])
  const [notifs,   setNotifs]   = useState<any[]>([])
  const [me,       setMe]       = useState<any>(null)
  const [typeFilter, setTypeFilter] = useState('All')
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const [t, p, us, n] = await Promise.all([
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Users').select('id,full_name,email,role'),
        supabase.from('Notifications').select('*').eq('user_id', session.user.id)
          .eq('is_read', false).order('created_at', { ascending: false }).limit(5),
      ])
      setTasks(t.data || [])
      setProjects(p.data || [])
      setUsers(us.data || [])
      setNotifs(n.data || [])
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date(); today.setHours(0,0,0,0)

  // Apply type filter
  const filteredTasks = typeFilter === 'All' ? tasks : tasks.filter(t => t.type === typeFilter)

  // Stats from filtered tasks
  const total      = filteredTasks.length
  const notStarted = filteredTasks.filter(t => t.status === 'Not Started').length
  const inProg     = filteredTasks.filter(t => t.status === 'In Progress').length
  const onHold     = filteredTasks.filter(t => t.status === 'On-Hold').length
  const completed  = filteredTasks.filter(t => t.status === 'Completed').length
  const overdue    = filteredTasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
  }).length
  const recurring  = filteredTasks.filter(t => t.type !== 'One-time').length
  const dueSoon    = filteredTasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0)
    const diff = Math.round((e.getTime() - today.getTime()) / 864e5)
    return diff >= 0 && diff <= 7
  }).length

  // My tasks
  const isMyTask = (t: any) => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || o.includes(n)
  }
  const myTasks   = filteredTasks.filter(isMyTask)
  const myOverdue = myTasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
  })
  const myDueSoon = myTasks.filter(t => {
    if (!t.end_date || t.status === 'Completed') return false
    const e = new Date(t.end_date); e.setHours(0,0,0,0)
    const diff = Math.round((e.getTime() - today.getTime()) / 864e5)
    return diff >= 0 && diff <= 7
  })

  // Completion rate
  const completionRate = total ? Math.round(completed/total*100) : 0

  const StatCard = ({ icon, label, value, sub, color, onClick }: any) => (
    <div className="stat-card" onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s' }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.boxShadow = 'none')}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ padding:'6px', borderRadius:'var(--r)', background:'var(--bg)', display:'flex' }}>
          {icon}
        </div>
        {sub && <span style={{ fontSize:10, color:'var(--txt3)', background:'var(--bg)', padding:'2px 6px', borderRadius:10 }}>{sub}</span>}
      </div>
      <div className={`stat-value ${color||''}`} style={{ fontSize:28, marginBottom:4 }}>{loading ? '—' : value}</div>
      <div className="stat-label" style={{ fontSize:12 }}>{label}</div>
    </div>
  )

  return (
    <AppShell title="Dashboard">

      {/* Type filter bar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:'var(--txt3)', marginRight:4 }}>Filter by type:</span>
        {['All', ...TYPES].map(t => (
          <button key={t} type="button"
            onClick={() => setTypeFilter(t)}
            className={typeFilter === t ? 'toggle-btn sel-owner' : 'toggle-btn'}
            style={{ fontSize:12 }}>
            {t === 'All' ? 'All Types' : t}
          </button>
        ))}
        {typeFilter !== 'All' && (
          <span style={{ fontSize:11, color:'var(--txt3)', marginLeft:4 }}>
            Showing {total} {typeFilter.toLowerCase()} task{total!==1?'s':''}
          </span>
        )}
      </div>

      {/* Stats grid — 4 cols row 1, 4 cols row 2 */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:12 }}>
        <StatCard icon={<Folders size={16} color="#185FA5"/>} label="Total Tasks"   value={total}      color="blue" />
        <StatCard icon={<AlertCircle size={16} color="#cc3333"/>} label="Overdue"   value={overdue}    color="red"
          sub={overdue > 0 ? '⚠ Action needed' : undefined}
          onClick={overdue > 0 ? () => router.push('/my-tasks') : undefined} />
        <StatCard icon={<Clock size={16} color="#854F0B"/>} label="Due This Week"   value={dueSoon}    color="amber" />
        <StatCard icon={<CheckCircle2 size={16} color="#3B6D11"/>} label="Completed" value={completed}  color="green" />
      </div>
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        <StatCard icon={<TrendingUp size={16} color="#185FA5"/>} label="In Progress"   value={inProg} color="blue" />
        <StatCard icon={<Clock size={16} color="#666"/>}         label="Not Started"   value={notStarted} />
        <StatCard icon={<RotateCcw size={16} color="#854F0B"/>}  label="Recurring"     value={recurring}  color="amber" />
        <StatCard icon={<Users size={16} color="#534AB7"/>}      label="Team Members"  value={users.length} />
      </div>

      {/* Completion progress bar */}
      <div className="card" style={{ padding:'12px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>Overall Completion</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#3B6D11' }}>{completionRate}%</div>
        </div>
        <div className="prog-bar" style={{ height:8 }}>
          <div className="prog-fill" style={{ width:`${completionRate}%`, background:'#3B6D11', transition:'width 0.4s ease' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--txt3)' }}>
          <span>{completed} completed</span>
          <span>{onHold} on hold</span>
          <span>{inProg} in progress</span>
          <span>{notStarted} not started</span>
        </div>
      </div>

      {/* Main content — 3 sections */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>

        {/* My overdue + due soon */}
        <div>
          {myOverdue.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'#cc3333' }}>
                  My Overdue <span style={{ background:'#fff0f0', color:'#cc3333', fontSize:10, padding:'1px 6px', borderRadius:10, marginLeft:4 }}>{myOverdue.length}</span>
                </div>
              </div>
              {myOverdue.slice(0,3).map(t => (
                <div key={t.id} className="task-row overdue" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <StatusDot status={t.status}/>
                  <div style={{ flex:1 }}>
                    <div className="task-name">{t.topic}</div>
                    <div className="task-meta"><span>Due {t.end_date}</span><span>{t.project_name}</span></div>
                  </div>
                  <StatusPill status={t.status}/>
                </div>
              ))}
              <div style={{ height:12 }}/>
            </>
          )}

          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
              Due This Week <span style={{ background:'var(--bg2)', color:'var(--txt3)', fontSize:10, padding:'1px 6px', borderRadius:10, marginLeft:4 }}>{myDueSoon.length}</span>
            </div>
          </div>
          {myDueSoon.length === 0
            ? <div style={{ fontSize:12, color:'var(--txt3)', padding:'8px 0' }}>Nothing due this week.</div>
            : myDueSoon.slice(0,4).map(t => (
                <div key={t.id} className="task-row" onClick={() => router.push(`/tasks/${t.id}`)}>
                  <StatusDot status={t.status}/>
                  <div style={{ flex:1 }}>
                    <div className="task-name">{t.topic}</div>
                    <div className="task-meta"><span>Due {t.end_date}</span><span>{t.project_name}</span></div>
                  </div>
                  <StatusPill status={t.status}/>
                </div>
              ))
          }
        </div>

        {/* Projects overview */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>Projects</div>
            <Link href="/my-projects" className="btn btn-sm" style={{ fontSize:11 }}>View all</Link>
          </div>
          {projects.length === 0
            ? <div style={{ fontSize:12, color:'var(--txt3)' }}>No projects yet.</div>
            : projects.slice(0,5).map(proj => {
                const pt   = filteredTasks.filter(t => t.project_name === proj.name)
                const done = pt.filter(t => t.status === 'Completed').length
                const over = pt.filter(t => {
                  if (!t.end_date || t.status === 'Completed') return false
                  const e = new Date(t.end_date); e.setHours(0,0,0,0); return e < today
                }).length
                const pct  = pt.length ? Math.round(done/pt.length*100) : 0
                return (
                  <div key={proj.id} style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <div className="proj-dot" style={{ background: proj.color_code||'#378ADD' }}/>
                      <div style={{ fontSize:13, fontWeight:500, flex:1, color:'var(--txt)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{proj.name}</div>
                      <div style={{ fontSize:11, color:'var(--txt3)', whiteSpace:'nowrap' }}>{done}/{pt.length}</div>
                      {over > 0 && <span className="pill pill-oh" style={{ fontSize:9 }}>{over} late</span>}
                      <span style={{ fontSize:11, fontWeight:600, color: pct===100?'#3B6D11':'var(--txt3)' }}>{pct}%</span>
                    </div>
                    <div className="prog-bar">
                      <div className="prog-fill" style={{ width:`${pct}%`, background: proj.color_code||'#378ADD', transition:'width 0.4s' }}/>
                    </div>
                  </div>
                )
              })
          }
        </div>

        {/* Recurring tasks + Notifications */}
        <div>
          {/* Recurring */}
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
                Recurring <span style={{ background:'var(--bg2)', color:'var(--txt3)', fontSize:10, padding:'1px 6px', borderRadius:10, marginLeft:4 }}>{tasks.filter(t=>t.type!=='One-time'&&t.status!=='Completed').length}</span>
              </div>
            </div>
            {tasks.filter(t => t.type !== 'One-time' && t.status !== 'Completed').slice(0,3).map(t => (
              <div key={t.id} className="task-row" onClick={() => router.push(`/tasks/${t.id}`)}>
                <span style={{ fontSize:14 }}>↻</span>
                <div style={{ flex:1 }}>
                  <div className="task-name">{t.topic}</div>
                  <div className="task-meta"><span>{t.type}</span><span>Due {t.end_date}</span></div>
                </div>
                <StatusPill status={t.status}/>
              </div>
            ))}
            {tasks.filter(t => t.type !== 'One-time' && t.status !== 'Completed').length === 0 && (
              <div style={{ fontSize:12, color:'var(--txt3)' }}>No active recurring tasks.</div>
            )}
          </div>

          {/* Notifications */}
          {notifs.length > 0 && (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
                  Unread <span style={{ background:'#E6F1FB', color:'#185FA5', fontSize:10, padding:'1px 6px', borderRadius:10, marginLeft:4 }}>{notifs.length}</span>
                </div>
                <Link href="/notifications" className="btn btn-sm" style={{ fontSize:11 }}>View all</Link>
              </div>
              <div className="card" style={{ padding:'4px 12px' }}>
                {notifs.map(n => (
                  <div key={n.id} className="notif-item">
                    <div className="notif-dot" style={{ background:'#378ADD' }}/>
                    <div className="notif-text">{n.message}</div>
                    <div className="notif-time">{n.created_at?.slice(0,10)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pipeline kanban — filtered */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--txt3)' }}>
          Pipeline {typeFilter !== 'All' && `· ${typeFilter}`}
        </div>
        <Link href="/tasks/create" className="btn btn-primary btn-sm">+ New Task</Link>
      </div>
      <div className="kanban-grid">
        {STATUSES.map(status => {
          const group = filteredTasks.filter(t => t.status === status)
          return (
            <div key={status}>
              <div className="col-header">
                <div style={{ width:8, height:8, borderRadius:'50%', background:
                  status==='Not Started'?'#aaa':status==='In Progress'?'#378ADD':
                  status==='On-Hold'?'#EF9F27':'#639922' }}/>
                {status}<span className="col-count">{group.length}</span>
              </div>
              {group.length === 0
                ? <div className="col-empty">No tasks</div>
                : group.slice(0,4).map(t => (
                    <div key={t.id} className="task-row" onClick={() => router.push(`/tasks/${t.id}`)}>
                      <StatusDot status={t.status}/>
                      <div style={{ flex:1 }}>
                        <div className="task-name">{t.topic}</div>
                        <div className="task-meta">
                          <span>{t.project_name}</span>
                          {t.type !== 'One-time' && <span>↻ {t.type}</span>}
                        </div>
                      </div>
                      <StatusPill status={t.status}/>
                    </div>
                  ))
              }
              {group.length > 4 && (
                <div style={{ fontSize:11, color:'var(--txt3)', textAlign:'center', marginTop:4 }}>
                  +{group.length-4} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
