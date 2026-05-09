'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function AllTasks() {
  const router = useRouter()
  const [tasks,     setTasks]     = useState<any[]>([])
  const [subtasks,  setSubtasks]  = useState<any[]>([])
  const [projects,  setProjects]  = useState<string[]>([])
  const [myRole,    setMyRole]    = useState('')
  const [sf,        setSf]        = useState('All')
  const [pf,        setPf]        = useState('All')
  const [collTask,  setCollTask]  = useState<Record<string,boolean>>({})

  useEffect(()=>{
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role||'')
      const [t,s] = await Promise.all([
        supabase.from('Tasks').select('*').order('project_name').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])
      setTasks(t.data||[])
      setSubtasks(s.data||[])
      setProjects([...new Set((t.data||[]).map((x:any)=>x.project_name).filter(Boolean))])
    }
    load()
  },[])

  if (myRole&&myRole==='Team Member') return (
    <AppShell title="All Tasks"><div className="alert alert-error">Access denied — Managers and Admins only.</div></AppShell>
  )

  let filtered = tasks
  if (sf!=='All') filtered = filtered.filter(t=>t.status===sf)
  if (pf!=='All') filtered = filtered.filter(t=>t.project_name===pf)

  const grouped: Record<string,any[]> = {}
  filtered.forEach(t=>{ const p=t.project_name||'No Project'; grouped[p]=(grouped[p]||[]).concat(t) })

  return (
    <AppShell title="All Tasks">
      <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
        <select className="form-select" style={{width:150}} value={sf} onChange={e=>setSf(e.target.value)}>
          <option value="All">All Status</option>
          {['Not Started','In Progress','On-Hold','Completed'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{width:200}} value={pf} onChange={e=>setPf(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map(p=><option key={p}>{p}</option>)}
        </select>
        <div style={{marginLeft:'auto',fontSize:12,color:'var(--txt3)'}}>{filtered.length} tasks</div>
        <Link href="/tasks/create" className="btn btn-primary btn-sm">+ Create Task</Link>
      </div>

      {Object.entries(grouped).map(([projName, ptasks])=>(
        <div key={projName} className="card" style={{padding:0,overflow:'hidden',marginBottom:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',background:'var(--bg2)',borderBottom:'0.5px solid var(--brd)'}}>
            <div className="proj-dot" style={{background:'#378ADD'}}/>
            <div style={{fontSize:14,fontWeight:500,flex:1,color:'var(--txt)'}}>{projName}</div>
            <div style={{fontSize:12,color:'var(--txt3)'}}>{ptasks.length} task{ptasks.length!==1?'s':''}</div>
          </div>
          <div style={{padding:'8px 16px 12px 16px'}}>
            {ptasks.map(t=>{
              const subs = subtasks.filter(s=>s.parent_task_id===t.id)
              const taskOpen = !collTask[t.id]
              return (
                <div key={t.id}>
                  <div className="task-row">
                    {subs.length>0&&(
                      <ChevronRight size={12} color="var(--txt3)"
                        style={{transform:taskOpen?'rotate(90deg)':'',transition:'transform 0.2s',cursor:'pointer',flexShrink:0}}
                        onClick={e=>{e.stopPropagation();setCollTask(c=>({...c,[t.id]:!c[t.id]}))}}/>
                    )}
                    {subs.length===0&&<div style={{width:12,flexShrink:0}}/>}
                    <StatusDot status={t.status}/>
                    <div className="task-name" onClick={()=>router.push(`/tasks/${t.id}`)}>{t.topic}</div>
                    <div className="task-meta"><span>{t.owner}</span><span>{t.end_date}</span></div>
                    {(t.tags||[]).map((tag:string)=><span key={tag} className="pill pill-tag" style={{fontSize:10}}>{tag}</span>)}
                    <StatusPill status={t.status}/>
                  </div>
                  {subs.length>0&&taskOpen&&(
                    <div style={{paddingLeft:28,marginBottom:4}}>
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
            })}
          </div>
        </div>
      ))}
      {filtered.length===0&&<div className="empty-state"><div style={{fontSize:32}}>📋</div><div style={{marginTop:8}}>No tasks found.</div></div>}
    </AppShell>
  )
}
