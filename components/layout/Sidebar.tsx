'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/theme'
import { LogOut, Moon, Sun } from 'lucide-react'

interface SidebarProps {
  user: { email: string; name: string; role: string; initials: string }
  unreadCount?: number
}

export default function Sidebar({ user, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const { theme, setTheme } = useTheme()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const NavItem = ({ href, icon, label, badge }: { href: string; icon: string; label: string; badge?: number }) => (
    <Link href={href} className={`nav-item ${isActive(href) ? 'active' : ''}`}>
      <i className={`ti ${icon}`} aria-hidden="true" style={{ fontSize: 16 }} />
      {label}
      {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
    </Link>
  )

  const role = user.role

  return (
    <div className="sidebar">
      <div className="sidebar-logo">⬛ ConOps Tasker</div>

      {/* All roles */}
      <div className="nav-label">Main</div>
      <NavItem href="/dashboard"     icon="ti-home"      label="Dashboard" />
      <NavItem href="/my-tasks"      icon="ti-checkbox"  label="My Tasks" />
      <NavItem href="/my-projects"   icon="ti-folder"    label="My Projects" />
      <NavItem href="/notifications" icon="ti-bell"      label="Notifications" badge={unreadCount} />

      {/* All roles can create tasks */}
      <div className="nav-label">Tasks</div>
      <NavItem href="/tasks/create"  icon="ti-plus"      label="Create Task" />

      {/* Manager + Admin */}
      {(role === 'Manager' || role === 'Admin') && (
        <>
          <div className="nav-label">Management</div>
          <NavItem href="/all-projects"    icon="ti-layout-grid"  label="All Projects" />
          <NavItem href="/all-tasks"       icon="ti-list-details" label="All Tasks" />
          <NavItem href="/projects/create" icon="ti-folder-plus"  label="New Project" />
        </>
      )}

      {/* Admin only */}
      {role === 'Admin' && (
        <>
          <div className="nav-label">Admin</div>
          <NavItem href="/admin/users"         icon="ti-users"        label="User Management" />
          <NavItem href="/admin/notifications" icon="ti-speakerphone" label="Notifications Mgmt" />
        </>
      )}

      <div className="sidebar-footer">
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}>
          {theme === 'light' ? <Moon size={13} /> : <Sun size={13} />}
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{user.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{role}</div>
          </div>
          <button onClick={signOut} className="btn btn-icon" title="Sign out" style={{ border: 'none', background: 'none' }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
