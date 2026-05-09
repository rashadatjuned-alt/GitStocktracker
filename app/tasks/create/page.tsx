'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'

const TYPES    = ['One-time','Weekly','Monthly','Quarterly','Semi-annually','Annually']
const STATUSES = ['Not Started','In Progress','On-Hold','Completed']

interface SubtaskDraft {
  id: string; topic: string; owner: string; start_date: string; end_date: string; status: string
}

export default function CreateTask() {
  const router   = useRouter()
  const today    = new Date().toISOString().split('T')[0]
  const nextWeek = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0]

  const [allProjects,     setAllProjects]     = useState<any[]>([])
  const [allUsers,        setAllUsers]        = useState<any[]>([])
  const [projectMembers,  setProjectMembers]  = useState<any[]>([])
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState('')

  const [project,   setProject]   = useState('')
  const [topic,     setTopic]     = useState('')
  const [type,      setType]      = useState('One-time')
  const [status,    setStatus]    = useState('Not Started')
  const [startDate, setStartDate] = useState(today)
  const [endDate,   setEndDate]   = useState(nextWeek)
  const [desc,      setDesc]      = useState('')
  const [owners,    setOwners]    = useState<string[]>([])
  const [subtasks,  setSubtasks]  = useState<SubtaskDraft[]>([])

  useEffect(() => {
    const load = async () => {
      const [p, u] = await Promise.all([
        supabase.from('Projects').select('*'),
        supabase.from('Users').select('id,full_name,email'),
      ])
      setAllProjects(p.data || [])
      setAllUsers(u.data || [])
    }
    load()
  }, [])

  // Load project members when project changes
  useEffect(() => {
    if (!project) { setProjectMembers(allUsers); setOwners([]); return }
    const proj = allProjects.find(p => p.name === project)
    if (proj?.members?.length) {
      const members = allUsers.filter(u => proj.members.includes(u.id))
      setProjectMembers(members.length ? members : allUsers)
    } else {
      setProjectMembers(allUsers)
    }
    setOwners([])
  }, [project, allProjects, allUsers])

  const toggleOwner = useCallback((name: string) =>
    setOwners(prev => prev.includes(name) ? prev.filter(o => o !== name) : [...prev, name]), [])

  const addSubtask = () => setSubtasks(prev => [...prev, {
    id: Math.random().toString(36).slice(2),
    topic: '', owner: '', start_date: startDate, end_date: endDate, status: 'Not Started'
  }])

  const updateSub = (id: string, field: string, val: string) =>
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s))

  const removeSub = (id: string) => setSubtasks(prev => prev.filter(s => s.id !== id))

  const handleSubmit = async () => {
    setError(''); setSuccess('')
    if (!topic.trim()) { setError('Task title is required.'); return }
    if (endDate < startDate) { setError('End date cannot be before start date.'); return }
    for (const s of subtasks) {
      if (!s.topic.trim()) { setError('All subtask titles are required.'); return }
      if (s.start_date < startDate || s.end_date > endDate) {
        setError(`Subtask "${s.topic}" dates must be within parent task dates.`); return
      }
    }
    if (status === 'Completed' && subtasks.length > 0 && !subtasks.every(s => s.status === 'Completed')) {
      setError('All subtasks must be completed before marking task as Completed.'); return
    }

    try {
      const { data: taskData, error: taskErr } = await supabase.from('Tasks').insert({
        project_name: project, topic: topic.trim(), description: desc.trim(),
        owner: owners.join(', '), type, start_date: startDate,
        end_date: endDate, status, tags: [],
      }).select().single()

      if (taskErr) throw new Error(`Task save failed: ${taskErr.message}`)

      // Insert subtasks
      const subErrors: string[] = []
      for (const s of subtasks) {
        const { error: subErr } = await supabase.from('Subtasks').insert({
          parent_task_id: taskData.id, topic: s.topic.trim(),
          owner: s.owner || null, start_date: s.start_date,
          end_date: s.end_date, status: s.status,
        })
        if (subErr) subErrors.push(`"${s.topic}": ${subErr.message}`)
      }
      if (subErrors.length > 0) {
        setError(`Task saved but subtask errors: ${subErrors.join('; ')}`)
        return
      }

      // Notify owners
      for (const ownerName of owners) {
        const u = allUsers.find(u => (u.full_name || u.email) === ownerName)
        if (u?.id) await supabase.from('Notifications').insert({
          user_id: u.id,
          message: `You were assigned: "${topic.trim()}"${project ? ` in ${project}` : ''}.`,
          is_read: false,
        })
      }

      setSuccess(`✅ Task "${topic}" created with ${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}!`)
      setTimeout(() => router.push('/my-tasks'), 1200)
    } catch (e: any) { setError(e.message) }
  }

  const resources = projectMembers.length ? projectMembers : allUsers

  return (
    <AppShell title="Create Task">
      <div style={{ maxWidth: 820 }}>
        {error   && <div className="alert alert-error"   style={{ marginBottom:12 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom:12 }}>{success}</div>}

        <div className="card">
          <div className="form-section">Task Details</div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Project</label>
              <select className="form-select" value={project} onChange={e => setProject(e.target.value)}>
                <option value="">Select project...</option>
                {allProjects.map(p => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input className="form-input" placeholder="Short, clear title" value={topic} onChange={e => setTopic(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Task Type</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Context, acceptance criteria, notes..."
              value={desc} onChange={e => setDesc(e.target.value)} />
          </div>

          {/* Assign To */}
          <div className="form-group">
            <label className="form-label">
              Assign To
              {project && <span style={{ fontSize:10, color:'var(--txt3)', marginLeft:6, fontWeight:400 }}>
                ({resources.length} resource{resources.length!==1?'s':''} from {project || 'all users'})
              </span>}
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {resources.map(u => {
                const name = u.full_name || u.email
                const sel  = owners.includes(name)
                return (
                  <button key={u.id} type="button"
                    className={sel ? 'toggle-btn sel-owner' : 'toggle-btn'}
                    onClick={() => toggleOwner(name)}>
                    {sel ? '✓ ' : ''}{name}
                  </button>
                )
              })}
            </div>
            {owners.length > 0 && (
              <div style={{ marginTop:6, fontSize:12, color:'var(--txt3)' }}>
                Assigned: {owners.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Subtasks */}
        <div className="card">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>
              Subtasks <span style={{ fontSize:11, color:'var(--txt3)' }}>({subtasks.length})</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={addSubtask}>
              <Plus size={13} /> Add Subtask
            </button>
          </div>

          {subtasks.length === 0 && (
            <div style={{ fontSize:13, color:'var(--txt3)', textAlign:'center', padding:'12px 0' }}>
              No subtasks. Click "Add Subtask" to add one.
            </div>
          )}

          {subtasks.map((s, i) => (
            <div key={s.id} className="sub-draft">
              <div style={{ display:'flex', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Subtask {i+1}
                </span>
                <button type="button" onClick={() => removeSub(s.id)}
                  style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#cc3333', display:'flex' }}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="form-grid-2" style={{ gap:8 }}>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Title *</label>
                  <input className="form-input" placeholder="Subtask title"
                    value={s.topic} onChange={e => updateSub(s.id, 'topic', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Assign To</label>
                  <select className="form-select" value={s.owner}
                    onChange={e => updateSub(s.id, 'owner', e.target.value)}>
                    <option value="">Unassigned</option>
                    {resources.map(u => (
                      <option key={u.id} value={u.full_name || u.email}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Status</label>
                  <select className="form-select" value={s.status}
                    onChange={e => updateSub(s.id, 'status', e.target.value)}>
                    {STATUSES.map(st => <option key={st}>{st}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom:0 }} />
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Start Date</label>
                  <input className="form-input" type="date" value={s.start_date}
                    onChange={e => updateSub(s.id, 'start_date', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">End Date</label>
                  <input className="form-input" type="date" value={s.end_date}
                    onChange={e => updateSub(s.id, 'end_date', e.target.value)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:24 }}>
          <button type="button" className="btn" onClick={() => router.back()}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            Save Task {subtasks.length > 0 ? `+ ${subtasks.length} Subtask${subtasks.length > 1 ? 's' : ''}` : ''}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
