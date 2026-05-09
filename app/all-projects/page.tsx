'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2 } from 'lucide-react'

export default function AllProjects() {
  const router = useRouter()
  const [projects,  setProjects]  = useState<any[]>([])
  const [tasks,     setTasks]     = useState<any[]>([])
  const [subtasks,  setSubtasks]  = useState<any[]>([])
  const [myRole,    setMyRole]    = useState('')
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [collTask,  setCollTask]  = useState<Record<string,boolean>>({})
  const [deleting,  setDeleting]  = useState<string|null>(null)

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role||'')
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

  const toggle     = (id:string) => setCollapsed(c=>({...c,[id]:!c[id]}))
  const toggleTask = (id:string) => setCollTask(c=>({...c,[id]:!c[id]}))

  const deleteProject = async (proj: any) => {
    if (!confirm(`Delete project "${proj.name}"?`)) return
    setDeleting(proj.id)
    await supabase.from('Projects').delete().eq('id', proj.id)
    setProjects(prev=>prev.filter(p=>p.id!==proj.id))
    setDeleting(null)
  }

  if (myRole&&myRole==='Team Member') return (
    <AppShell title="All Projects">
      <div className="alert alert-error">Access denied — Managers and Admins only.</div>
    </AppShell>
  )

  return (
    <AppShell title="All Projects">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:12,color:'var(--txt3)'}}>{projects.length} project{projects.length!==1?'s':''}</div>
      </div>

      {projects.length===0&&<div className="empty-state"><div style={{fontSize:32}}>📁</div><div style={{marginTop:8}}>No projects yet.</div></div>}

      {projects.map(proj=>{
        const ptasks = tasks.filter(t=>t.project_name===proj.name)
        const done   = ptasks.filter(t=>t.status==='Completed').length
        const pct    = ptasks.length ? Math.round(done/ptasks.length*100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} className="proj-card">
            <div className="proj-header">
              <div style={{display:'flex',alignItems:'center',gap:10,flex:1,cursor:'pointer'}} onClick={()=>toggle(proj.id)}>
                <ChevronRight size={14} color="var(--txt3)" style={{transform:isOpen?'rotate(90deg)':'',transition:'transform 0.2s'}}/>
                <div className="proj-dot" style={{background:proj.color_code||'#378ADD'}}/>
                <div className="proj-name">{proj.name}</div>
                <div className="proj-meta">{ptasks.length} tasks</div>
                <div style={{fontSize:12,color:'var(--txt3)'}}>{pct}%</div>
                <div className="prog-bar" style={{width:60,marginTop:0}}>
                  <div className="prog-fill" style={{width:`${pct}%`,background:proj.color_code||'#378ADD'}}/>
                </div>
              </div>
              {(myRole==='Admin'||myRole==='Manager')&&(
                <button title="Delete project" onClick={()=>deleteProject(proj)} disabled={deleting===proj.id}
                  style={{background:'none',border:'none',cursor:'pointer',color:'#cc3333',display:'flex',padding:4,opacity:deleting===proj.id?0.5:1}}>
                  <Trash2 size={14}/>
                </button>
              )}
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
      })}
    </AppShell>
  )
}
