import { Status, TaskType } from '@/types'

const MAP: Record<string,string> = { 'Not Started':'pill-ns','In Progress':'pill-ip','On-Hold':'pill-oh','Completed':'pill-c' }
const DOT: Record<string,string> = { 'Not Started':'#aaa','In Progress':'#378ADD','On-Hold':'#EF9F27','Completed':'#639922' }

export function StatusPill({ status }: { status: Status }) {
  return <span className={`pill ${MAP[status]||'pill-ns'}`}>{status}</span>
}
export function TypePill({ type }: { type: TaskType }) {
  if (!type || type === 'One-time') return null
  return <span className="pill pill-rc">↻ {type}</span>
}
export function StatusDot({ status }: { status: Status }) {
  return <div className="task-dot" style={{ background: DOT[status]||'#aaa' }} />
}
