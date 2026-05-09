'use client'
import { Task } from '@/types'
import { StatusPill, StatusDot, TypePill } from './StatusPill'
import { useRouter } from 'next/navigation'

interface TaskRowProps {
  task: Task
  onClick?: () => void
  showProject?: boolean
  isOverdue?: boolean
}

export default function TaskRow({ task, onClick, showProject = true, isOverdue }: TaskRowProps) {
  const router = useRouter()
  const meta = [
    task.end_date,
    task.owner,
    showProject ? task.project_name : null,
  ].filter(Boolean)

  const handleClick = () => {
    if (onClick) onClick()
    else router.push(`/tasks/${task.id}`)
  }

  return (
    <div className={`task-row ${isOverdue ? 'overdue' : ''}`} onClick={handleClick}>
      <StatusDot status={task.status} />
      <div className="task-name">{task.topic}</div>
      <div className="task-meta">
        {meta.map((m, i) => <span key={i}>{m}</span>)}
      </div>
      {(task.tags || []).map(tag => (
        <span key={tag} className="pill pill-ns" style={{ marginLeft: 3, fontSize: 10 }}>{tag}</span>
      ))}
      <StatusPill status={task.status} />
      <TypePill type={task.type} />
    </div>
  )
}
