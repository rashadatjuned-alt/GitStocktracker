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
  members: string[]   // array of user ids assigned to this project
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
  owner?: string       // assigned resource
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
