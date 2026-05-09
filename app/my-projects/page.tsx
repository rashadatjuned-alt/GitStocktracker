'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { LayoutList, Columns } from 'lucide-react'

export default function MyProjects() {
  const router = useRouter()
  const [projects,  setProjects]  = useState<any[]>([])
  const [tasks,     setTasks]     = useState<any[]>([])
  const [subtasks,  setSubtasks]  = useState<any[]>([])
  const [me,        setMe]        = useState<any>(null)
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [collTask,  setCollTask]  = useState<Record<string,boolean>>({})
  const [view,      setView]      = useState<'list'|'kanban'>('list')

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const [p,t,s] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])
      setProjects(p.data||[])
      setTasks(t.data||[])
      setSubtasks(s.data||[])
    }
    load()
  },[])

  const isMyTask = (t: any) => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e)||o.includes(n)
  }

  // My projects = projects where I own a task
  const myProjectNames = [...new Set(tasks.filter(isMyTask).map(t=>t.project_name).filter(Boolean))]
  const myProjects = projects.filter(p=>myProjectNames.includes(p.name))

  const toggle     = (id:string) => setCollapsed(c=>({...c,[id]:!c[id]}))
  const toggleTask = (id:string) => setCollTask(c=>({...c,[id]:!c[id]}))

  const ProjectHierarchy = ({ proj }: { proj: any }) => {
    const ptasks = tasks.filter(t=>t.project_name===proj.name)
    const done   = ptasks.filter(t=>t.status==='Completed').length
    const pct    = ptasks.length ? Math.round(done/ptasks.length*100) : 0
    const isOpen = !collapsed[proj.id]

    return (
      <div className="proj-card">
        <div className="proj-header" onClick={()=>toggle(proj.id)}>
          <ChevronRight size={14} color="var(--txt3)" style={{transform:isOpen?'rotate(90deg)':'',transition:'transform 0.2s'}}/>
          <div className="proj-dot" style={{background:proj.color_code||'#378ADD'}}/>
          <div className="proj-name">{proj.name}</div>
          {proj.description&&<div className="proj-meta" style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{proj.description}</div>}
          <div className="proj-meta">{ptasks.length} task{ptasks.length!==1?'s':''}</div>
          <div style={{fontSize:12,color:'var(--txt3)'}}>{pct}%</div>
          <div className="prog-bar" style={{width:60,marginTop:0}}>
            <div className="prog-fill" style={{width:`${pct}%`,background:proj.color_code||'#378ADD'}}/>
          </div>
        </div>

        {isOpen&&(
          <div style={{paddingLeft:22,paddingRight:16,paddingBottom:10}}>
            <div style={{borderTop:'0.5px solid var(--brd)',marginBottom:8}}/>
            {ptasks.length===0
              ? <div style={{fontSize:13,color:'var(--txt3)',padding:'4px 0'}}>No tasks yet.</div>
              : ptasks.map(t=>{
                  const subs = subtasks.filter(s=>s.parent_task_id===t.id)
                  const taskOpen = !collTask[t.id]
                  return (
                    <div key={t.id}>
                      <div className="task-row" style={{marginBottom:subs.length&&taskOpen?4:6}}>
                        {subs.length>0&&(
                          <ChevronRight size={12} color="var(--txt3)"
                            style={{transform:taskOpen?'rotate(90deg)':'',transition:'transform 0.2s',cursor:'pointer',flexShrink:0}}
                            onClick={e=>{e.stopPropagation();toggleTask(t.id)}}/>
                        )}
                        {subs.length===0&&<div style={{width:12,flexShrink:0}}/>}
                        <StatusDot status={t.status}/>
                        <div className="task-name" onClick={()=>router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                        <div className="task-meta"><span>{t.owner}</span><span>{t.end_date}</span></div>
                        {(t.tags||[]).map((tag:string)=><span key={tag} className="pill pill-tag" style={{fontSize:10}}>{tag}</span>)}
                        <StatusPill status={t.status}/>
                      </div>
                      {subs.length>0&&taskOpen&&(
                        <div style={{paddingLeft:28,marginBottom:6}}>
                          {subs.map(s=>(
                            <div key={s.id} className="sub-row">
                              <span style={{color:'var(--txt3)',fontSize:12}}>↳</span>
                              <span style={{flex:1}}>{s.topic}</span>
                              <span style={{fontSize:11,color:'var(--txt3)'}}>{s.start_date} → {s.end_date}</span>
                              <StatusPill status={s.status}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>
        )}
      </div>
    )
  }

  // Kanban: tasks from my projects grouped by status
  const myAllTasks = tasks.filter(t=>myProjectNames.includes(t.project_name))
  const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const

  return (
    <AppShell title="My Projects">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--txt3)'}}>{myProjects.length} project{myProjects.length!==1?'s':''}</div>
        <div style={{display:'flex',gap:4}}>
          <button className={view==='list'?'btn btn-primary':'btn'} onClick={()=>setView('list')} style={{padding:'5px 8px'}}><LayoutList size={15}/></button>
          <button className={view==='kanban'?'btn btn-primary':'btn'} onClick={()=>setView('kanban')} style={{padding:'5px 8px'}}><Columns size={15}/></button>
        </div>
      </div>

      {myProjects.length===0&&<div className="empty-state"><div style={{fontSize:32}}>📁</div><div style={{marginTop:8}}>No projects assigned to you.</div></div>}

      {/* LIST — hierarchy */}
      {view==='list'&&myProjects.map(p=><ProjectHierarchy key={p.id} proj={p}/>)}

      {/* KANBAN */}
      {view==='kanban'&&(
        <div className="kanban-grid">
          {STATUSES.map(status=>{
            const group = myAllTasks.filter(t=>t.status===status)
            return (
              <div key={status}>
                <div className="col-header">{status}<span className="col-count">{group.length}</span></div>
                {group.length===0
                  ? <div className="col-empty">No tasks</div>
                  : group.map(t=>(
                      <div key={t.id} className="task-row" onClick={()=>router.push(`/tasks/${t.id}`)}>
                        <StatusDot status={t.status}/>
                        <div style={{flex:1}}>
                          <div className="task-name">{t.topic}</div>
                          <div className="task-meta"><span>{t.project_name}</span></div>
                        </div>
                        <StatusPill status={t.status}/>
                      </div>
                    ))
                }
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
