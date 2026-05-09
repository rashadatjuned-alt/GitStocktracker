'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot, TypePill } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { LayoutList, Columns } from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed'] as const
const DOT_CLR: Record<string,string> = { 'Not Started':'#aaa','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922' }

export default function MyTasks() {
  const router = useRouter()
  const [tasks,   setTasks]   = useState<any[]>([])
  const [me,      setMe]      = useState<any>(null)
  const [sf,      setSf]      = useState('All')
  const [pf,      setPf]      = useState('All')
  const [view,    setView]    = useState<'list'|'kanban'>('list')
  const [dragging,setDragging]= useState<string|null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      setMe({ ...u, email: session.user.email })
      const { data } = await supabase.from('Tasks').select('*').order('end_date')
      setTasks(data || [])
    }
    load()
  }, [])

  const isMyTask = (t: any) => {
    const o = (t.owner||'').toLowerCase()
    const e = (me?.email||'').toLowerCase()
    const n = (me?.full_name||'').toLowerCase()
    return o.includes(e) || o.includes(n) || (n.length>2 && o.split(',').some((x:string)=>x.trim()&&n.includes(x.trim())))
  }

  const mine     = tasks.filter(isMyTask)
  let filtered   = mine
  if (sf!=='All') filtered = filtered.filter(t=>t.status===sf)
  if (pf!=='All') filtered = filtered.filter(t=>t.project_name===pf)
  const projects = [...new Set(mine.map(t=>t.project_name).filter(Boolean))]

  const today = new Date(); today.setHours(0,0,0,0)
  const overdue = filtered.filter(t=>t.status!=='Completed'&&t.end_date&&new Date(t.end_date)<today)
  const active  = filtered.filter(t=>t.status!=='Completed'&&!(t.end_date&&new Date(t.end_date)<today))
  const done    = filtered.filter(t=>t.status==='Completed')

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('taskId', id); setDragging(id)
  },[])
  const handleDragEnd   = useCallback(() => setDragging(null),[])
  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect='move' },[])

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('taskId')
    const task = tasks.find(t=>t.id===id)
    if (!task||task.status===newStatus) { setDragging(null); return }
    if (newStatus==='Completed') {
      const { data: subs } = await supabase.from('Subtasks').select('status').eq('parent_task_id', id)
      if (subs?.some((s:any)=>s.status!=='Completed')) {
        alert('All subtasks must be completed first.'); setDragging(null); return
      }
    }
    setTasks(prev=>prev.map(t=>t.id===id?{...t,status:newStatus}:t))
    await supabase.from('Tasks').update({status:newStatus}).eq('id',id)
    setDragging(null)
  },[tasks])

  const TaskCard = ({ task }: { task: any }) => {
    const isOver = task.end_date&&new Date(task.end_date)<today&&task.status!=='Completed'
    return (
      <div className={`task-row ${isOver?'overdue':''} ${dragging===task.id?'dragging':''}`}
        onClick={()=>router.push(`/tasks/${task.id}`)}
        draggable onDragStart={e=>handleDragStart(e,task.id)} onDragEnd={handleDragEnd}
        style={{cursor:'grab'}}>
        <StatusDot status={task.status}/>
        <div style={{flex:1}}>
          <div className="task-name">{task.topic}</div>
          <div className="task-meta">
            {task.end_date&&<span>{isOver?'⚠ ':''}{task.end_date}</span>}
            {task.project_name&&<span>{task.project_name}</span>}
          </div>
        </div>
        {(task.tags||[]).map((tag:string)=><span key={tag} className="pill pill-tag" style={{fontSize:10}}>{tag}</span>)}
        <StatusPill status={task.status}/>
        <TypePill type={task.type}/>
      </div>
    )
  }

  const Group = ({ label, items, accent }: { label:string; items:any[]; accent?:string }) => {
    if (!items.length) return null
    return (
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',color:accent||'var(--txt3)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
          {label}<span style={{background:'var(--bg2)',color:'var(--txt3)',fontSize:10,padding:'1px 6px',borderRadius:10}}>{items.length}</span>
        </div>
        {items.map(t=><TaskCard key={t.id} task={t}/>)}
      </div>
    )
  }

  return (
    <AppShell title="My Tasks">
      {/* Toolbar */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <select className="form-select" style={{width:150}} value={sf} onChange={e=>setSf(e.target.value)}>
          <option value="All">All Status</option>
          {STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="form-select" style={{width:180}} value={pf} onChange={e=>setPf(e.target.value)}>
          <option value="All">All Projects</option>
          {projects.map(p=><option key={p}>{p}</option>)}
        </select>
        <div style={{marginLeft:'auto',display:'flex',gap:4}}>
          <button className={view==='list'?'btn btn-primary':'btn'} onClick={()=>setView('list')} title="List view" style={{padding:'5px 8px'}}><LayoutList size={15}/></button>
          <button className={view==='kanban'?'btn btn-primary':'btn'} onClick={()=>setView('kanban')} title="Kanban view" style={{padding:'5px 8px'}}><Columns size={15}/></button>
        </div>
        <div style={{fontSize:12,color:'var(--txt3)'}}>{filtered.length} task{filtered.length!==1?'s':''}</div>
      </div>

      {filtered.length===0&&<div className="empty-state"><div style={{fontSize:32}}>☑</div><div style={{marginTop:8}}>No tasks assigned to you.</div></div>}

      {/* LIST VIEW */}
      {view==='list'&&filtered.length>0&&(
        <>
          <Group label="Overdue"   items={overdue}  accent="#cc3333"/>
          <Group label="Active"    items={active}/>
          <Group label="Completed" items={done}/>
        </>
      )}

      {/* KANBAN VIEW */}
      {view==='kanban'&&(
        <div className="kanban-grid">
          {STATUSES.map(status=>{
            const group = filtered.filter(t=>t.status===status)
            return (
              <div key={status} className="kanban-col"
                onDragOver={handleDragOver} onDrop={e=>handleDrop(e,status)}>
                <div className="col-header">
                  <div style={{width:8,height:8,borderRadius:'50%',background:DOT_CLR[status]}}/>
                  {status}<span className="col-count">{group.length}</span>
                </div>
                {group.length===0
                  ? <div className="col-empty">Drop tasks here</div>
                  : group.map(t=><TaskCard key={t.id} task={t}/>)
                }
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
