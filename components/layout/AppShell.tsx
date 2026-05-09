'use client'
import { useEffect, useState, ReactNode, memo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sidebar from './Sidebar'
import { Search } from 'lucide-react'

const MemoSidebar = memo(Sidebar)

export default function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const router  = useRouter()
  const [user,    setUser]    = useState<any>(null)
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth'); return }
      const { data: u } = await supabase.from('Users').select('*').eq('id', session.user.id).single()
      const name = u?.full_name || session.user.email?.split('@')[0] || 'User'
      const parts = name.trim().split(' ')
      const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase()
      setUser({ id: session.user.id, email: session.user.email, name, initials, role: u?.role || 'Team Member' })
      const { data: n } = await supabase.from('Notifications').select('id').eq('user_id', session.user.id).eq('is_read', false)
      setUnread(n?.length || 0)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--txt3)', fontSize:13 }}>
      Loading ConOps Tasker...
    </div>
  )
  if (!user) return null

  return (
    <div className="app">
      <MemoSidebar user={user} unreadCount={unread} />
      <div className="main">
        <div className="topbar">
          <div className="topbar-title">{title}</div>
          <div className="search-box">
            <Search size={13} />
            Search tasks, projects...
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
