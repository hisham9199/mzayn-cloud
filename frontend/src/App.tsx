import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { authApi } from './api/client'
import Dashboard from './pages/Dashboard'
import Stables from './pages/Stables'
import Camels from './pages/Camels'
import Championships from './pages/Championships'
import ChampionshipDetail from './pages/ChampionshipDetail'
import BulkImport from './pages/BulkImport'
import Analysis from './pages/Analysis'
import ExcelIO from './pages/ExcelIO'
import Login from './pages/Login'

/* ─── Nav items ─── */
const NAV_GROUPS = [
    {
        label: 'الرئيسية',
        items: [
            { to: '/', label: 'لوحة التحكم', exact: true, icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
            )},
            { to: '/stables', label: 'المنقيات', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
            )},
        ],
    },
    {
        label: 'إدارة النياق',
        items: [
            { to: '/camels', label: 'النياق', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
                </svg>
            )},
            { to: '/bulk-import', label: 'استيراد من صور', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                </svg>
            )},
        ],
    },
    {
        label: 'البطولات والتحليل',
        items: [
            { to: '/championships', label: 'البطولات', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
                    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
                </svg>
            )},
            { to: '/analysis', label: 'تحليل المنقية', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                </svg>
            )},
            { to: '/excel', label: 'Excel استيراد/تصدير', icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
            )},
        ],
    },
]

/* ─── Page Titles Map ─── */
const PAGE_TITLES: Record<string, string> = {
    '/': 'لوحة التحكم',
    '/stables': 'المنقيات',
    '/camels': 'النياق',
    '/bulk-import': 'استيراد من صور',
    '/championships': 'البطولات',
    '/analysis': 'تحليل المنقية',
    '/excel': 'Excel استيراد / تصدير',
}

/* ─── Sidebar Logo SVG ─── */
function CamelLogo() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, color: '#fff' }}>
            <path d="M4 14s0-4 3-4 3 4 3 4"/>
            <path d="M10 14v-3a3 3 0 016 0v1"/>
            <path d="M13 12c0-1.5 1-3 3-3s3 1 3 3v3"/>
            <path d="M4 14v5"/><path d="M10 14v5"/><path d="M13 14v5"/><path d="M19 14v5"/>
        </svg>
    )
}

/* ─── Hamburger Icon ─── */
function MenuIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
    )
}

/* ─── Sidebar Component ─── */
function Sidebar({ open, onClose, user }: { open: boolean; onClose: () => void; user?: any }) {
    const isAdmin = user?.role === 'admin'

    // فلترة القوائم للمستخدم العادي (إخفاء المنقيات إذا كان مخصصاً لمنقيته فقط)
    const filteredGroups = NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (item.to === '/stables' && !isAdmin) return false // المنقيات العامة تظهر للأدمن
            return true
        })
    }))

    return (
        <>
            {open && <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" />}
            <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="القائمة الجانبية">
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="sidebar-logo" aria-hidden="true">
                        <CamelLogo />
                    </div>
                    <div className="sidebar-brand-text">
                        <div className="sidebar-brand-name">نظام مزاين</div>
                        <div className="sidebar-brand-sub">
                            {isAdmin ? '🛡️ لوحة الإدارة العامة' : `🐪 منقية ${user?.stable_name || user?.global_name || ''}`}
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
                    {filteredGroups.map(group => (
                        <div key={group.label}>
                            <div className="nav-section">{group.label}</div>
                            {group.items.map(item => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.exact}
                                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                    onClick={onClose}
                                    aria-label={item.label}
                                >
                                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <div className="sidebar-footer-version">نظام مزاين v1.0 © 2025</div>
                </div>
            </aside>
        </>
    )
}

/* ─── Layout ─── */
function Layout({ children, user, onLogout }: { children: React.ReactNode; user: any; onLogout: () => void }) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const location = useLocation()

    useEffect(() => {
        setSidebarOpen(false)
    }, [location.pathname])

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)')
        const handler = (e: MediaQueryListEvent) => { if (e.matches) setSidebarOpen(false) }
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
    }, [])

    const pageTitle = Object.entries(PAGE_TITLES).find(([path]) =>
        path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
    )?.[1] ?? 'نظام مزاين'

    const isAdmin = user?.role === 'admin'

    return (
        <div className="app-layout">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />
            <div className="main-layout">
                {/* Header */}
                <header className="page-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            className="hamburger-btn"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="فتح القائمة"
                            aria-expanded={sidebarOpen}
                        >
                            <MenuIcon />
                        </button>
                        <div className="header-title">{pageTitle}</div>
                    </div>

                    {/* User profile & status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            padding: '0.3rem 0.75rem',
                            borderRadius: '9999px',
                            background: isAdmin ? 'rgba(220, 38, 38, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                            border: `1px solid ${isAdmin ? '#dc2626' : '#16a34a'}`,
                            color: isAdmin ? '#ef4444' : '#22c55e',
                            fontSize: '0.78rem',
                            fontWeight: 700
                        }}>
                            {isAdmin ? '👑 مدير (Admin)' : '👤 عضو (BasicUser)'}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {user.avatar ? (
                                <img
                                    src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.avatar}.png?size=64`}
                                    alt={user.username}
                                    style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid var(--border)' }}
                                />
                            ) : (
                                <div style={{
                                    width: 34, height: 34, borderRadius: '50%',
                                    background: 'var(--primary-light)',
                                    border: '2px solid var(--primary-medium)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)',
                                }}>
                                    {(user.global_name || user.username || 'م')[0]}
                                </div>
                            )}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
                                {user.global_name || user.username}
                            </span>
                        </div>

                        <button
                            onClick={onLogout}
                            title="تسجيل الخروج"
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--border)',
                                color: 'var(--text-muted)',
                                padding: '0.35rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}
                        >
                            خروج 🚪
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="page-content">
                    {children}
                </main>
            </div>
        </div>
    )
}

/* ─── App ─── */
export default function App() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [authError, setAuthError] = useState<string | null>(null)

    useEffect(() => {
        // فحص البارامترات في الرابط بعد عودة ديسكورد
        const params = new URLSearchParams(window.location.search)
        const tokenFromUrl = params.get('token')
        const errorFromUrl = params.get('error')

        if (tokenFromUrl) {
            localStorage.setItem('mzayn_token', tokenFromUrl)
            window.history.replaceState({}, document.title, window.location.pathname)
        }

        if (errorFromUrl) {
            setAuthError(errorFromUrl)
            window.history.replaceState({}, document.title, window.location.pathname)
        }

        // جلب بيانات المستخدم
        const token = localStorage.getItem('mzayn_token')
        if (token) {
            authApi.getMe()
                .then(res => {
                    setUser(res.data)
                })
                .catch(() => {
                    localStorage.removeItem('mzayn_token')
                    setUser(null)
                })
                .finally(() => {
                    setLoading(false)
                })
        } else {
            setLoading(false)
        }
    }, [])

    const handleLogout = () => {
        localStorage.removeItem('mzayn_token')
        setUser(null)
    }

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                color: '#fff',
                fontFamily: 'Cairo, sans-serif'
            }}>
                <div className="spinner" style={{ width: 44, height: 44, marginBottom: '1rem' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>جاري التحقق من هوية الديسكورد...</div>
            </div>
        )
    }

    if (!user) {
        return (
            <>
                <Toaster position="top-left" />
                <Login error={authError} />
            </>
        )
    }

    return (
        <BrowserRouter>
            <Toaster
                position="top-left"
                toastOptions={{
                    style: {
                        background: '#fff',
                        color: '#0F172A',
                        border: '1px solid #E2E8F0',
                        fontFamily: 'Cairo, Arial, sans-serif',
                        direction: 'rtl',
                        borderRadius: '10px',
                        boxShadow: '0 10px 15px rgba(15,23,42,0.08)',
                        fontSize: '0.875rem',
                    },
                    success: { iconTheme: { primary: '#16A34A', secondary: '#fff' } },
                    error:   { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
                }}
            />
            <Routes>
                <Route path="/"              element={<Layout user={user} onLogout={handleLogout}><Dashboard /></Layout>} />
                <Route path="/stables"       element={<Layout user={user} onLogout={handleLogout}><Stables /></Layout>} />
                <Route path="/camels"        element={<Layout user={user} onLogout={handleLogout}><Camels /></Layout>} />
                <Route path="/bulk-import"   element={<Layout user={user} onLogout={handleLogout}><BulkImport /></Layout>} />
                <Route path="/championships" element={<Layout user={user} onLogout={handleLogout}><Championships /></Layout>} />
                <Route path="/championships/:id" element={<Layout user={user} onLogout={handleLogout}><ChampionshipDetail /></Layout>} />
                <Route path="/analysis"      element={<Layout user={user} onLogout={handleLogout}><Analysis /></Layout>} />
                <Route path="/excel"         element={<Layout user={user} onLogout={handleLogout}><ExcelIO /></Layout>} />
            </Routes>
        </BrowserRouter>
    )
}
