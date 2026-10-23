import type { ReactNode } from 'react'

type NavigationItem = {
  id: 'overview' | 'transactions' | 'budgets' | 'accounts' | 'reports' | 'savings' | 'investments'
  page?: 'overview' | 'transactions' | 'budgets' | 'accounts' | 'savings' | 'investments' | 'reports'
  label: string
  icon: ReactNode
  available: boolean
}

const navigationItems: NavigationItem[] = [
  { id: 'overview', page: 'overview', label: 'Overview', icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>, available: true },
  { id: 'transactions', page: 'transactions', label: 'Transactions', icon: <><path d="M4 7h15l-3-3" /><path d="M20 17H5l3 3" /><path d="M19 7l-3 3" /><path d="M5 17l3-3" /></>, available: true },
  { id: 'budgets', page: 'budgets', label: 'Budgets', icon: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3" /></>, available: true },
  { id: 'accounts', page: 'accounts', label: 'Accounts', icon: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M7 15h3" /><path d="M7 5V3h10v2" /></>, available: true },
  { id: 'reports', page: 'reports', label: 'Reports', icon: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>, available: true },
  { id: 'savings', page: 'savings', label: 'Savings goals', icon: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></>, available: true },
  { id: 'investments', page: 'investments', label: 'Investments', icon: <><path d="M3 17l6-6 4 3 8-9" /><path d="M15 5h6v6" /></>, available: true },
]

interface SidebarProps {
  profileName: string
  open: boolean
  page: 'overview' | 'transactions' | 'budgets' | 'accounts' | 'savings' | 'investments' | 'reports'
  onNavigate: (page: 'overview' | 'transactions' | 'budgets' | 'accounts' | 'savings' | 'investments' | 'reports') => void
  onClose: () => void
  onChangeProfile: () => void
}

export function Sidebar({ profileName, open, page, onNavigate, onClose, onChangeProfile }: SidebarProps) {
  const initials = profileName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U'

  return (
    <>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <a className="brand sidebar-brand" href="#" aria-label="Ledger finance overview">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></span>
          <span>Ledger<span className="brand-dot">.</span></span>
        </a>

        <p className="sidebar-section-label">WORKSPACE</p>
        <button className="workspace-switcher" type="button" onClick={() => { onChangeProfile(); onClose() }} aria-label="Change finance profile">
          <span className="workspace-avatar">{initials.slice(0, 1)}</span>
          <span className="workspace-copy"><strong>Finance workspace</strong><small>Dataverse</small></span>
          <span className="workspace-chevron" aria-hidden="true">⌄</span>
        </button>

        <p className="sidebar-section-label menu-label">MENU</p>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <button
              className={`sidebar-nav-item${page === item.page ? ' sidebar-nav-active' : ''}`}
              key={item.label}
              type="button"
              disabled={!item.available}
              aria-current={page === item.id ? 'page' : undefined}
              data-active={page === item.id}
              title={item.available ? undefined : `${item.label} page will be built later`}
              onClick={item.available ? () => { if (item.page) onNavigate(item.page); onClose() } : undefined}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">{item.icon}</svg>
              <span>{item.label}</span>
              {!item.available && <span className="nav-soon">Soon</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-promo">
            <span className="promo-mark" aria-hidden="true">✦</span>
            <strong>Make money simple</strong>
            <p>Your finance workspace, organized in one place.</p>
          </div>
          <div className="sidebar-profile">
            <span className="profile-avatar">{initials}</span>
            <span className="profile-copy"><strong>{profileName}</strong><small>Dataverse profile</small></span>
          </div>
        </div>
      </aside>
    </>
  )
}
