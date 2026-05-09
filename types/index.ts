export type Role = 'Admin' | 'Manager' | 'Team Member'
export type Status = 'Not Started' | 'In Progress' | 'On-Hold' | 'Completed'
export type TaskType = 'One-time' | 'Weekly' | 'Monthly' | 'Quarterly' | 'Semi-annually' | 'Annually'

export interface User {
  id: string
  email: string
  full_name: string
  role: Role
}

export interface Project {
  id: string
  name: string
  description?: string
  color_code: string
  created_at?: string
}

export interface Task {
  id: string
  project_name: string
  topic: string
  description?: string
  owner: string
  type: TaskType
  start_date: string
  end_date: string
  status: Status
  tags?: string[]
  created_at?: string
}

export interface Subtask {
  id: string
  parent_task_id: string
  topic: string
  start_date: string
  end_date: string
  status: Status
}

export interface Notification {
  id: string
  user_id: string
  message: string
  is_read: boolean
  created_at: string
}

export interface Comment {
  id: string
  task_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}
