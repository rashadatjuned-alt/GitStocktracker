'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { StatusPill } from '@/components/ui/StatusPill'
import { Trash2, Plus, ArrowLeft } from 'lucide-react'

const STATUSES = ['Not Started','In Progress','On-Hold','Completed']

interface Subtask {
  id: string
  topic: string
  start_date: string
  end_date: string
  status: string
  isNew?: boolean
}

export default function TaskDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [task,      setTask]      = useState<any>(null)
  const [subtasks,  setSubtasks]  = useState<Subtask[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [comments,  setComments]  = useState<any[]>([])
  const [newComment,setNewComment]= useState('')
  const [myUser,    setMyUser]    = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data: me } = await supabase.from('Users').select('*').eq('id', session?.user.id).single()
      setMyUser(me)

      const [t, s] = await Promise.all([
        supabase.from('Tasks').select('*').eq('id', id).single(),
        supabase.from('Subtasks').select('*').eq('parent_task_id', id).order('created_at'),
      ])
      setTask(t.data)
      setSubtasks(s.data || [])
      setLoading(false)
    }
    load()
  }, [id])

  const updateTask = useCallback((field: string, value: string) => {
    setTask((prev: any) => ({ ...prev, [field]: value }))
  }, [])

  const updateSubtask = useCallback((sid: string, field: string, value: string) => {
    setSubtasks(prev => prev.map(s => s.id === sid ? { ...s, [field]: value } : s))
  }, [])

  const addSubtask = () => {
    setSubtasks(prev => [...prev, {
      id: crypto.randomUUID(),
      topic: '', start_date: task.start_date,
      end_date: task.end_date, status: 'Not Started', isNew: true
    }])
  }

  const deleteSubtask = async (s: Subtask) => {
    if (!s.isNew && !confirm('Delete this subtask?')) return
    if (!s.isNew) await supabase.from('Subtasks').delete().eq('id', s.id)
    setSubtasks(prev => prev.filter(sub => sub.id !== s.id))
  }

  const handleSave = async () => {
    setError(''); setSaving(true)

    // Block completion if subtasks not all done
    if (task.status === 'Completed' && subtasks.length > 0) {
      const allDone = subtasks.every(s => s.status === 'Completed')
      if (!allDone) {
        setError('All subtasks must be completed before marking task as Completed.')
        setSaving(false); return
      }
    }

    // Validate subtask dates
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); setSaving(false); return }
      if (s.start_date < task.start_date || s.end_date > task.end_date) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`)
        setSaving(false); return
      }
    }

    try {
      // Save task
      await supabase.from('Tasks').update({
        topic: task.topic, description: task.description,
        owner: task.owner, status: task.status,
        start_date: task.start_date, end_date: task.end_date,
        type: task.type, tags: task.tags,
      }).eq('id', id)

      // Save subtasks
      for (const s of subtasks) {
        if (s.isNew) {
          await supabase.from('Subtasks').insert({
            parent_task_id: id, topic: s.topic,
            start_date: s.start_date, end_date: s.end_date, status: s.status
          })
        } else {
          await supabase.from('Subtasks').update({
            topic: s.topic, start_date: s.start_date,
            end_date: s.end_date, status: s.status
          }).eq('id', s.id)
        }
      }

      setSuccess('Saved successfully!')
      setTimeout(() => setSuccess(''), 2000)
    } catch(e: any) { setError(e.message) }
    setSaving(false)
  }

  const addComment = async () => {
    if (!newComment.trim() || !myUser) return
    const name = myUser.full_name || myUser.email
    const msg = `${name}: ${newComment.trim()}`
    // Store as notification to self and task owner for simplicity
    setComments(prev => [...prev, { id: Date.now(), user: name, text: newComment.trim(), time: 'just now' }])
    setNewComment('')
  }

  if (loading) return <AppShell title="Task Detail"><div style={{ padding:40, color:'var(--text-tertiary)' }}>Loading...</div></AppShell>
  if (!task)   return <AppShell title="Task Detail"><div className="alert alert-error">Task not found.</div></AppShell>

  return (
    <AppShell title={task.topic || 'Task Detail'}>
      {/* Back + status */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <button className="btn" onClick={() => router.back()} style={{ padding:'5px 8px' }}>
          <ArrowLeft size={14} />
        </button>
        <div style={{ flex:1, fontSize:15, fontWeight:500, color:'var(--text-primary)' }}>{task.topic}</div>
        <StatusPill status={task.status} />
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom:12 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom:12 }}>{success}</div>}

      <div className="two-col">
        {/* Left: Task details */}
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
                  {['One-time','Weekly','Monthly','Quarterly','Semi-annually','Annually'].map(t => <option key={t}>{t}</option>)}
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
              <input className="form-input" value={task.owner || ''}
                onChange={e => updateTask('owner', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={task.description || ''}
                onChange={e => updateTask('description', e.target.value)} />
            </div>

            {/* Tags */}
            {(task.tags || []).length > 0 && (
              <div className="form-group">
                <label className="form-label">Tags</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {(task.tags || []).map((tag: string) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Subtasks */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>
                Subtasks
                <span style={{ fontSize:11, color:'var(--text-tertiary)', marginLeft:6 }}>
                  ({subtasks.filter(s=>s.status==='Completed').length}/{subtasks.length} done)
                </span>
              </div>
              <button className="btn" onClick={addSubtask} style={{ fontSize:12 }}>
                <Plus size={13} /> Add
              </button>
            </div>

            {subtasks.length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-tertiary)', textAlign:'center', padding:'12px 0' }}>
                No subtasks yet.
              </div>
            )}

            {subtasks.map((s, i) => (
              <div key={s.id} style={{ background:'var(--bg-secondary)', borderRadius:6, padding:10, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--text-tertiary)' }}>#{i+1}</span>
                  <input className="form-input" style={{ flex:1 }} placeholder="Subtask title"
                    value={s.topic} onChange={e => updateSubtask(s.id, 'topic', e.target.value)} />
                  <button type="button" onClick={() => deleteSubtask(s)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#cc3333', display:'flex' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="form-grid-3" style={{ gap:6 }}>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-select" value={s.status}
                      onChange={e => updateSubtask(s.id, 'status', e.target.value)}>
                      {STATUSES.map(st => <option key={st}>{st}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Start</label>
                    <input className="form-input" type="date" value={s.start_date}
                      onChange={e => updateSubtask(s.id, 'start_date', e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">End</label>
                    <input className="form-input" type="date" value={s.end_date}
                      onChange={e => updateSubtask(s.id, 'end_date', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            {subtasks.length > 0 && (
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Subtasks'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Meta + Comments */}
        <div>
          <div className="card">
            <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Task Info</div>
            <div className="meta-grid">
              <div><div className="meta-label">Project</div><div className="meta-value">{task.project_name || '—'}</div></div>
              <div><div className="meta-label">Owner</div><div className="meta-value">{task.owner || '—'}</div></div>
              <div><div className="meta-label">Start</div><div className="meta-value">{task.start_date || '—'}</div></div>
              <div><div className="meta-label">End</div><div className="meta-value">{task.end_date || '—'}</div></div>
              <div><div className="meta-label">Type</div><div className="meta-value">{task.type || '—'}</div></div>
              <div><div className="meta-label">Status</div><div className="meta-value"><StatusPill status={task.status} /></div></div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>Comments</div>
            {comments.length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-tertiary)', marginBottom:12 }}>No comments yet.</div>
            )}
            {comments.map(c => (
              <div key={c.id} className="notif-item">
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)' }}>{c.user}</div>
                  <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:2 }}>{c.text}</div>
                </div>
                <div style={{ fontSize:11, color:'var(--text-tertiary)' }}>{c.time}</div>
              </div>
            ))}
            <div className="comment-box">
              <input className="comment-input" placeholder="Add a comment..."
                value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addComment()} />
              <button className="btn btn-primary" onClick={addComment} style={{ flexShrink:0 }}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
