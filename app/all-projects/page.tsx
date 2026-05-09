'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { StatusPill, StatusDot } from '@/components/ui/StatusPill'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'

export default function AllProjects() {
  const router = useRouter()
  const [projects,  setProjects]  = useState<any[]>([])
  const [tasks,     setTasks]     = useState<any[]>([])
  const [subtasks,  setSubtasks]  = useState<any[]>([])
  const [myRole,    setMyRole]    = useState('')
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [collTask,  setCollTask]  = useState<Record<string,boolean>>({})

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: u } = await supabase.from('Users').select('role').eq('id', session.user.id).single()
      setMyRole(u?.role || '')
      const [p, t, s] = await Promise.all([
        supabase.from('Projects').select('*').order('created_at'),
        supabase.from('Tasks').select('*').order('end_date'),
        supabase.from('Subtasks').select('*'),
      ])
      setProjects(p.data || [])
      setTasks(t.data || [])
      setSubtasks(s.data || [])
    }
    load()
  }, [])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'

  if (myRole && myRole === 'Team Member') return (
    <AppShell title="All Projects">
      <div className="alert alert-error">Access denied — Managers and Admins only.</div>
    </AppShell>
  )

  const deleteProject = async (proj: any) => {
    if (!confirm(`Delete project "${proj.name}"? All tasks will remain but lose their project.`)) return
    await supabase.from('Projects').delete().eq('id', proj.id)
    setProjects(prev => prev.filter(p => p.id !== proj.id))
  }

  const deleteTask = async (taskId: string, topic: string) => {
    if (!confirm(`Delete task "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('parent_task_id', taskId)
    await supabase.from('Tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setSubtasks(prev => prev.filter(s => s.parent_task_id !== taskId))
  }

  const deleteSubtask = async (subId: string, topic: string) => {
    if (!confirm(`Delete subtask "${topic}"?`)) return
    await supabase.from('Subtasks').delete().eq('id', subId)
    setSubtasks(prev => prev.filter(s => s.id !== subId))
  }

  return (
    <AppShell title="All Projects">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{projects.length} project{projects.length !== 1 ? 's' : ''}</div>
        <Link href="/projects/create" className="btn btn-primary btn-sm"><Plus size={13} /> New Project</Link>
      </div>

      {projects.length === 0 && <div className="empty-state"><div style={{ fontSize: 32 }}>📁</div><div style={{ marginTop: 8 }}>No projects yet.</div></div>}

      {projects.map(proj => {
        const ptasks = tasks.filter(t => t.project_name === proj.name)
        const done   = ptasks.filter(t => t.status === 'Completed').length
        const pct    = ptasks.length ? Math.round(done / ptasks.length * 100) : 0
        const isOpen = !collapsed[proj.id]

        return (
          <div key={proj.id} className="proj-card">
            <div className="proj-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }}
                onClick={() => setCollapsed(c => ({ ...c, [proj.id]: !c[proj.id] }))}>
                <ChevronRight size={14} color="var(--txt3)"
                  style={{ transform: isOpen ? 'rotate(90deg)' : '', transition: 'transform 0.2s' }} />
                <div className="proj-dot" style={{ background: proj.color_code || '#378ADD' }} />
                <div className="proj-name">{proj.name}</div>
                {proj.description && <div className="proj-meta" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.description}</div>}
                <div className="proj-meta">{ptasks.length} tasks</div>
                <div style={{ fontSize: 12, color: 'var(--txt3)' }}>{pct}%</div>
                <div className="prog-bar" style={{ width: 60, marginTop: 0 }}>
                  <div className="prog-fill" style={{ width: `${pct}%`, background: proj.color_code || '#378ADD' }} />
                </div>
              </div>
              {/* Admin/Manager actions */}
              <div style={{ display: 'flex', gap: 4 }}>
                <Link href="/tasks/create" className="btn btn-sm" title="Add task to this project">
                  <Plus size={12} />
                </Link>
                {canDelete && (
                  <button onClick={() => deleteProject(proj)} title="Delete project"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc3333', display: 'flex', padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {isOpen && (
              <div style={{ paddingLeft: 22, paddingRight: 16, paddingBottom: 10 }}>
                <div style={{ borderTop: '0.5px solid var(--brd)', marginBottom: 8 }} />
                {ptasks.length === 0
                  ? <div style={{ fontSize: 13, color: 'var(--txt3)', padding: '4px 0' }}>No tasks yet.</div>
                  : ptasks.map(t => {
                      const subs = subtasks.filter(s => s.parent_task_id === t.id)
                      const taskOpen = !collTask[t.id]
                      return (
                        <div key={t.id}>
                          <div className="task-row" style={{ marginBottom: subs.length && taskOpen ? 3 : 6 }}>
                            {subs.length > 0 && (
                              <ChevronRight size={12} color="var(--txt3)"
                                style={{ transform: taskOpen ? 'rotate(90deg)' : '', transition: 'transform 0.2s', cursor: 'pointer', flexShrink: 0 }}
                                onClick={e => { e.stopPropagation(); setCollTask(c => ({ ...c, [t.id]: !c[t.id] })) }} />
                            )}
                            {subs.length === 0 && <div style={{ width: 12, flexShrink: 0 }} />}
                            <StatusDot status={t.status} />
                            <div className="task-name" onClick={() => router.push(`/tasks/${t.id}`)} style={{ flex: 1 }}>{t.topic}</div>
                            <div className="task-meta"><span>{t.owner}</span><span>{t.end_date}</span></div>
                            {(t.tags || []).map((tag: string) => <span key={tag} className="pill pill-tag" style={{ fontSize: 10 }}>{tag}</span>)}
                            <StatusPill status={t.status} />
                            {/* Edit always visible, delete for admin/manager */}
                            <button onClick={() => router.push(`/tasks/${t.id}`)} className="btn btn-sm" title="Edit task" style={{ padding: '2px 6px', fontSize: 11 }}>Edit</button>
                            {canDelete && (
                              <button onClick={() => deleteTask(t.id, t.topic)} title="Delete task"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc3333', display: 'flex', padding: 4 }}>
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>

                          {subs.length > 0 && taskOpen && (
                            <div style={{ paddingLeft: 28, marginBottom: 6 }}>
                              {subs.map(s => (
                                <div key={s.id} className="sub-row" style={{ border: '0.5px solid var(--brd)', borderRadius: 'var(--r)', marginBottom: 3 }}>
                                  <span style={{ color: 'var(--txt3)', fontSize: 12 }}>↳</span>
                                  <span style={{ flex: 1 }}>{s.topic}</span>
                                  <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{s.start_date} → {s.end_date}</span>
                                  <StatusPill status={s.status} />
                                  {canDelete && (
                                    <button onClick={() => deleteSubtask(s.id, s.topic)} title="Delete subtask"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc3333', display: 'flex', padding: 2 }}>
                                      <Trash2 size={12} />
                                    </button>
                                  )}
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
