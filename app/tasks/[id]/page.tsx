'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Trash2, Plus, ArrowLeft, ChevronRight, Copy } from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed']
const TYPES    = ['One-time','Weekly','Monthly','Quarterly','Semi-annually','Annually']

const RECURRENCE_DAYS: Record<string, number> = {
  'Weekly':        7,
  'Monthly':       30,
  'Quarterly':     91,
  'Semi-annually': 183,
  'Annually':      365,
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function shiftMonth(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

function nextDate(start: string, end: string, type: string): { start: string; end: string } {
  const duration = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 864e5)
  let newStart = start
  if (type === 'Weekly')        newStart = shiftDate(start, 7)
  else if (type === 'Monthly')  newStart = shiftMonth(start, 1)
  else if (type === 'Quarterly')newStart = shiftMonth(start, 3)
  else if (type === 'Semi-annually') newStart = shiftMonth(start, 6)
  else if (type === 'Annually') newStart = shiftMonth(start, 12)
  return { start: newStart, end: shiftDate(newStart, duration) }
}

interface Subtask {
  id: string; topic: string; owner?: string
  start_date: string; end_date: string; status: string; isNew?: boolean
}

export default function TaskDetail() {
  const router  = useRouter()
  const { id }  = useParams<{ id: string }>()
  const [task,       setTask]       = useState<any>(null)
  const [subtasks,   setSubtasks]   = useState<Subtask[]>([])
  const [projectMembers, setProjectMembers] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [cloning,    setCloning]    = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')
  const [newComment, setNewComment] = useState('')
  const [comments,   setComments]   = useState<any[]>([])
  const [myUser,     setMyUser]     = useState<any>(null)
  const [myRole,     setMyRole]     = useState('')
  const [subsOpen,   setSubsOpen]   = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: me } = await supabase.from('Users').select('*').eq('id', session?.user.id).single()
      setMyUser(me)
      setMyRole(me?.role || 'Team Member')

      const [t, s] = await Promise.all([
        supabase.from('Tasks').select('*').eq('id', id).single(),
        supabase.from('Subtasks').select('*').eq('parent_task_id', id).order('created_at'),
      ])
      setTask(t.data)
      setSubtasks(s.data || [])

      // Load project members for assignment
      if (t.data?.project_name) {
        const { data: proj } = await supabase.from('Projects').select('members').eq('name', t.data.project_name).single()
        if (proj?.members?.length) {
          const { data: users } = await supabase.from('Users').select('id,full_name,email').in('id', proj.members)
          setProjectMembers(users || [])
        } else {
          const { data: users } = await supabase.from('Users').select('id,full_name,email')
          setProjectMembers(users || [])
        }
      }

      setLoading(false)
    }
    load()
  }, [id])

  const canDelete = myRole === 'Admin' || myRole === 'Manager'

  const updateTask = useCallback((field: string, value: string) =>
    setTask((prev: any) => ({ ...prev, [field]: value })), [])

  const updateSubtask = useCallback((sid: string, field: string, value: string) =>
    setSubtasks(prev => prev.map(s => s.id === sid ? { ...s, [field]: value } : s)), [])

  const addSubtask = () => setSubtasks(prev => [...prev, {
    id: Math.random().toString(36).slice(2),
    topic: '', owner: '', start_date: task.start_date,
    end_date: task.end_date, status: 'Not Started', isNew: true
  }])

  const deleteSubtask = async (s: Subtask) => {
    if (!canDelete) return
    if (!s.isNew && !confirm('Delete this subtask?')) return
    if (!s.isNew) await supabase.from('Subtasks').delete().eq('id', s.id)
    setSubtasks(prev => prev.filter(sub => sub.id !== s.id))
  }

  const deleteTask = async () => {
    if (!canDelete) return
    if (!confirm(`Delete task "${task.topic}"?`)) return
    setDeleting(true)
    await supabase.from('Subtasks').delete().eq('parent_task_id', id)
    await supabase.from('Tasks').delete().eq('id', id)
    router.back()
  }

  // ── Clone task ─────────────────────────────────────────────────────
  const cloneTask = async () => {
    setCloning(true)
    setError('')
    try {
      // Shift dates if recurring, otherwise keep same
      const isRecurring = task.type !== 'One-time'
      const dates = isRecurring
        ? nextDate(task.start_date, task.end_date, task.type)
        : { start: task.start_date, end: task.end_date }

      const { data: newTask, error: tErr } = await supabase.from('Tasks').insert({
        project_name: task.project_name,
        topic:        task.topic,
        description:  task.description,
        owner:        task.owner,
        type:         task.type,
        start_date:   dates.start,
        end_date:     dates.end,
        status:       'Not Started',
        tags:         task.tags || [],
      }).select().single()
      if (tErr) throw tErr

      // Copy all subtasks with reset status and shifted dates
      const duration = Math.round((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / 864e5)
      for (const s of subtasks) {
        const subDuration = Math.round((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / 864e5)
        const subOffset   = Math.round((new Date(s.start_date).getTime() - new Date(task.start_date).getTime()) / 864e5)
        const newSubStart = shiftDate(dates.start, subOffset)
        const newSubEnd   = shiftDate(newSubStart, subDuration)

        await supabase.from('Subtasks').insert({
          parent_task_id: newTask.id,
          topic:          s.topic,
          owner:          s.owner || null,
          start_date:     newSubStart,
          end_date:       newSubEnd,
          status:         'Not Started',
        })
      }

      setSuccess(isRecurring
        ? `✅ Next ${task.type.toLowerCase()} instance created (${dates.start} → ${dates.end}) with ${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}!`
        : `✅ Task cloned successfully!`)
      setTimeout(() => router.push(`/tasks/${newTask.id}`), 1800)
    } catch(e: any) {
      setError(`Clone failed: ${e.message}`)
    }
    setCloning(false)
  }

  // ── Save task + auto-generate next if recurring + completed ────────
  const handleSave = async () => {
    setError(''); setSaving(true)

    if (task.status === 'Completed' && subtasks.length > 0) {
      if (!subtasks.every(s => s.status === 'Completed')) {
        setError('All subtasks must be completed before marking task as Completed.')
        setSaving(false); return
      }
    }
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
      if (s.start_date < task.start_date || s.end_date > task.end_date) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`); setSaving(false); return
      }
    }

    try {
      // Get previous status to detect completion transition
      const { data: prev } = await supabase.from('Tasks').select('status').eq('id', id).single()
      const wasCompleted = prev?.status === 'Completed'

      await supabase.from('Tasks').update({
        topic: task.topic, description: task.description, owner: task.owner,
        status: task.status, start_date: task.start_date, end_date: task.end_date,
        type: task.type, tags: task.tags,
      }).eq('id', id)

      for (const s of subtasks) {
        if (s.isNew) {
          await supabase.from('Subtasks').insert({
            parent_task_id: id, topic: s.topic, owner: s.owner || null,
            start_date: s.start_date, end_date: s.end_date, status: s.status
          })
        } else {
          await supabase.from('Subtasks').update({
            topic: s.topic, owner: s.owner || null,
            start_date: s.start_date, end_date: s.end_date, status: s.status
          }).eq('id', s.id)
        }
      }
      setSubtasks(prev => prev.map(s => ({ ...s, isNew: false })))

      // ── Auto-generate next recurring instance ─────────────────────
      const justCompleted = task.status === 'Completed' && !wasCompleted
      const isRecurring   = task.type !== 'One-time'

      if (justCompleted && isRecurring) {
        const dates = nextDate(task.start_date, task.end_date, task.type)

        // Check if next instance already exists
        const { data: existing } = await supabase.from('Tasks')
          .select('id').eq('topic', task.topic)
          .eq('start_date', dates.start).single()

        if (!existing) {
          const { data: newTask } = await supabase.from('Tasks').insert({
            project_name: task.project_name, topic: task.topic,
            description: task.description, owner: task.owner,
            type: task.type, start_date: dates.start,
            end_date: dates.end, status: 'Not Started', tags: task.tags || [],
          }).select().single()

          if (newTask) {
            // Copy subtasks with proportionally shifted dates
            for (const s of subtasks) {
              const subOffset   = Math.round((new Date(s.start_date).getTime() - new Date(task.start_date).getTime()) / 864e5)
              const subDuration = Math.round((new Date(s.end_date).getTime() - new Date(s.start_date).getTime()) / 864e5)
              const newSubStart = shiftDate(dates.start, subOffset)
              const newSubEnd   = shiftDate(newSubStart, subDuration)
              await supabase.from('Subtasks').insert({
                parent_task_id: newTask.id, topic: s.topic,
                owner: s.owner || null, start_date: newSubStart,
                end_date: newSubEnd, status: 'Not Started',
              })
            }

            // Notify owner
            if (task.owner) {
              const owners = task.owner.split(',').map((o: string) => o.trim())
              for (const ownerName of owners) {
                const { data: u } = await supabase.from('Users')
                  .select('id').or(`full_name.eq.${ownerName},email.eq.${ownerName}`).single()
                if (u?.id) {
                  await supabase.from('Notifications').insert({
                    user_id: u.id,
                    message: `🔄 Next ${task.type} instance of "${task.topic}" has been created (${dates.start} → ${dates.end}).`,
                    is_read: false,
                  })
                }
              }
            }

            setSuccess(`✅ Saved! Next ${task.type.toLowerCase()} instance auto-created for ${dates.start} → ${dates.end} with ${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}.`)
            setSaving(false)
            return
          }
        }
      }

      setSuccess('✅ Changes saved!')
      setTimeout(() => setSuccess(''), 3000)
    } catch(e: any) { setError(e.message) }
    setSaving(false)
  }

  const addComment = () => {
    if (!newComment.trim() || !myUser) return
    const name = myUser.full_name || myUser.email
    setComments(prev => [...prev, { id: Date.now(), user: name, text: newComment.trim(), time: 'just now' }])
    setNewComment('')
  }

  const completedSubs = subtasks.filter(s => s.status === 'Completed').length
  const isRecurring   = task?.type && task.type !== 'One-time'

  if (loading) return <AppShell title="Task Detail"><div style={{ padding: 40, color: 'var(--txt3)' }}>Loading...</div></AppShell>
  if (!task)   return <AppShell title="Task Detail"><div className="alert alert-error">Task not found.</div></AppShell>

  return (
    <AppShell title={task.topic || 'Task Detail'}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-icon" onClick={() => router.back()}><ArrowLeft size={14} /></button>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--txt)', minWidth: 0 }}>{task.topic}</div>
        <StatusPill status={task.status} />

        {/* Recurring badge */}
        {isRecurring && (
          <span className="pill pill-rc" style={{ fontSize: 11 }}>↻ {task.type}</span>
        )}

        {/* Clone button — everyone */}
        <button className="btn btn-sm" onClick={cloneTask} disabled={cloning}
          title={isRecurring ? `Create next ${task.type.toLowerCase()} instance` : 'Clone this task'}>
          <Copy size={13} />
          {cloning ? 'Cloning...' : isRecurring ? `Clone → Next ${task.type}` : 'Clone Task'}
        </button>

        {/* Delete — admin/manager only */}
        {canDelete && (
          <button className="btn btn-danger btn-sm" onClick={deleteTask} disabled={deleting}>
            <Trash2 size={13} /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        )}
      </div>

      {/* Recurring info banner */}
      {isRecurring && (
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          🔄 <strong>{task.type} recurring task</strong> — When marked Completed, the next instance will be auto-created with all subtasks copied and dates shifted forward.
        </div>
      )}

      {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

      {/* Subtasks */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => setSubsOpen(o => !o)}>
          <ChevronRight size={14} color="var(--txt3)"
            style={{ transform: subsOpen ? 'rotate(90deg)' : '', transition: 'transform 0.2s' }} />
          <div style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--txt)' }}>
            Subtasks
            <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 8 }}>
              {completedSubs}/{subtasks.length} completed
            </span>
          </div>
          {subtasks.length > 0 && (
            <>
              <div style={{ width: 100 }}>
                <div className="prog-bar">
                  <div className="prog-fill" style={{ width: `${Math.round(completedSubs/subtasks.length*100)}%`, background: '#3B6D11' }} />
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--txt3)', minWidth: 28 }}>
                {Math.round(completedSubs/subtasks.length*100)}%
              </span>
            </>
          )}
          <button type="button" className="btn btn-sm btn-primary"
            onClick={e => { e.stopPropagation(); addSubtask() }}>
            <Plus size={12} /> Add Subtask
          </button>
        </div>

        {subsOpen && (
          <div style={{ marginTop: 12, borderTop: '0.5px solid var(--brd)', paddingTop: 12 }}>
            {subtasks.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '8px 0' }}>
                No subtasks yet. Click "Add Subtask" to add one.
              </div>
            )}
            {subtasks.map((s, i) => (
              <div key={s.id} style={{ background: 'var(--bg2)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt3)', minWidth: 22 }}>#{i+1}</span>
                  <input className="form-input" style={{ flex: 1, minWidth: 120, fontSize: 13 }}
                    placeholder="Subtask title" value={s.topic}
                    onChange={e => updateSubtask(s.id, 'topic', e.target.value)} />
                  {/* Assign to — project resources */}
                  <select className="form-select" style={{ width: 140 }}
                    value={s.owner || ''}
                    onChange={e => updateSubtask(s.id, 'owner', e.target.value)}>
                    <option value="">Unassigned</option>
                    {projectMembers.map(u => (
                      <option key={u.id} value={u.full_name || u.email}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                  <select className="form-select" style={{ width: 130 }}
                    value={s.status} onChange={e => updateSubtask(s.id, 'status', e.target.value)}>
                    {STATUSES.map(st => <option key={st}>{st}</option>)}
                  </select>
                  <input className="form-input" type="date" style={{ width: 130 }}
                    value={s.start_date} onChange={e => updateSubtask(s.id, 'start_date', e.target.value)} />
                  <input className="form-input" type="date" style={{ width: 130 }}
                    value={s.end_date} onChange={e => updateSubtask(s.id, 'end_date', e.target.value)} />
                  {canDelete ? (
                    <button onClick={() => deleteSubtask(s)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc3333', display: 'flex', padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  ) : <div style={{ width: 21 }} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="two-col">
        {/* Left: edit form */}
        <div>
          <div className="card">
            <div className="form-section">Task Details</div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" value={task.topic || ''}
                onChange={e => updateTask('topic', e.target.value)} />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={task.status}
                  onChange={e => updateTask('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={task.type}
                  onChange={e => updateTask('type', e.target.value)}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={task.start_date || ''}
                  onChange={e => updateTask('start_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input className="form-input" type="date" value={task.end_date || ''}
                  onChange={e => updateTask('end_date', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Assigned To</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {projectMembers.map(u => {
                  const name = u.full_name || u.email
                  const sel  = (task.owner || '').includes(name)
                  return (
                    <button key={u.id} type="button"
                      className={sel ? 'toggle-btn sel-owner' : 'toggle-btn'}
                      onClick={() => {
                        const owners = (task.owner || '').split(',').map((o: string) => o.trim()).filter(Boolean)
                        const next   = sel ? owners.filter((o: string) => o !== name) : [...owners, name]
                        updateTask('owner', next.join(', '))
                      }}>
                      {sel ? '✓ ' : ''}{name}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={task.description || ''}
                onChange={e => updateTask('description', e.target.value)} />
            </div>
            {(task.tags || []).length > 0 && (
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(task.tags || []).map((tag: string) => <span key={tag} className="tag">{tag}</span>)}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : isRecurring && task.status === 'Completed' ? 'Save & Auto-create Next' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: info + comments */}
        <div>
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--txt)' }}>Task Info</div>
            <div className="meta-grid">
              <div><div className="meta-label">Project</div><div className="meta-value">{task.project_name || '—'}</div></div>
              <div><div className="meta-label">Owner</div><div className="meta-value">{task.owner || '—'}</div></div>
              <div><div className="meta-label">Start</div><div className="meta-value">{task.start_date || '—'}</div></div>
              <div><div className="meta-label">End</div><div className="meta-value">{task.end_date || '—'}</div></div>
              <div><div className="meta-label">Type</div><div className="meta-value">{task.type || '—'}</div></div>
              <div><div className="meta-label">Status</div><div className="meta-value"><StatusPill status={task.status} /></div></div>
            </div>
            {isRecurring && task.start_date && task.end_date && (
              <>
                <div style={{ borderTop: '0.5px solid var(--brd)', margin: '10px 0' }} />
                <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                  Next instance: <strong style={{ color: 'var(--txt)' }}>
                    {nextDate(task.start_date, task.end_date, task.type).start}
                  </strong>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: 'var(--txt)' }}>Comments</div>
            {comments.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 12 }}>No comments yet.</div>
            )}
            {comments.map(c => (
              <div key={c.id} className="notif-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)' }}>{c.user}</div>
                  <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>{c.text}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{c.time}</div>
              </div>
            ))}
            <div className="comment-box">
              <input className="comment-input" placeholder="Add a comment..."
                value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()} />
              <button className="btn btn-primary" onClick={addComment}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
