import { useQuery } from 'react-query'
import toast from 'react-hot-toast'
import { dashboardApi, backupApi } from '../api/client'

const IconCamel = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M4 14s0-4 3-4 3 4 3 4" />
        <path d="M10 14v-3a3 3 0 016 0v1" />
        <path d="M13 12c0-1.5 1-3 3-3s3 1 3 3v3" />
        <path d="M4 14v5" /><path d="M10 14v5" /><path d="M13 14v5" /><path d="M19 14v5" />
    </svg>
)

const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

const IconCoin = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M14.8 9A2 2 0 0013 8h-2a2 2 0 000 4h2a2 2 0 010 4h-2a2 2 0 01-1.8-1" />
        <path d="M12 6v2m0 8v2" />
    </svg>
)

const IconBuilding = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
    </svg>
)

const IconTrophy = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
        <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
)

const IconSparkles = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
    </svg>
)

const IconSave = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
)

function StatCard({ label, value, color, bgColor, icon }: {
    label: string; value: number | string; color: string; bgColor: string; icon: React.ReactNode
}) {
    return (
        <div className="stat-card">
            <div className="stat-icon" style={{ background: bgColor, color }}>
                {icon}
            </div>
            <div>
                <div className="stat-value">{typeof value === 'number' ? value.toLocaleString('ar') : value}</div>
                <div className="stat-label">{label}</div>
            </div>
        </div>
    )
}

export default function Dashboard() {
    const { data, isLoading } = useQuery('dashboard', () => dashboardApi.stats().then(r => r.data))

    if (isLoading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '5rem' }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
        </div>
    )

    const d = data || {} as any

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-top">
                <div>
                    <h1>لوحة التحكم</h1>
                    <p className="page-subtitle">نظرة عامة على نظام إدارة النياق</p>
                </div>
                <div className="page-top-actions">
                    <button className="btn btn-secondary" onClick={async () => {
                        try {
                            await backupApi.create()
                            toast.success('تم إنشاء نسخة احتياطية بنجاح')
                        } catch {
                            toast.error('حدث خطأ أثناء إنشاء النسخة الاحتياطية')
                        }
                    }}>
                        <IconSave />
                        نسخة احتياطية
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                <StatCard
                    icon={<IconCamel />} label="إجمالي النياق"
                    value={d.total_camels ?? 0}
                    color="var(--info)" bgColor="var(--info-light)"
                />
                <StatCard
                    icon={<IconCheck />} label="نياق متوفرة"
                    value={d.available_camels ?? 0}
                    color="var(--success)" bgColor="var(--success-light)"
                />
                <StatCard
                    icon={<IconCoin />} label="نياق مباعة"
                    value={d.sold_camels ?? 0}
                    color="var(--danger)" bgColor="var(--danger-light)"
                />
                <StatCard
                    icon={<IconBuilding />} label="المنقيات"
                    value={d.stables_count ?? 0}
                    color="var(--warning)" bgColor="var(--warning-light)"
                />
            </div>

            {/* Review Alert */}
            {d.needs_review > 0 && (
                <div className="validation-alert warning" style={{ marginBottom: '1.5rem' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                        <strong>{d.needs_review}</strong> ناقة تحتاج مراجعة بيانات أو تصحيح
                    </span>
                </div>
            )}

            {/* Two-column section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem' }}>
                {/* Best per stable */}
                <div className="card">
                    <div className="section-title">
                        <div className="section-title-icon"><IconTrophy /></div>
                        <h2>أفضل نتيجة لكل منقية</h2>
                    </div>
                    {(d.best_per_stable || []).length === 0 ? (
                        <div className="empty-state" style={{ padding: '1.5rem' }}>
                            <p>لا توجد بطولات محسوبة بعد</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {(d.best_per_stable || []).map((s: any) => (
                                <div key={s.stable_id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.75rem 1rem',
                                    background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.stable_name}</span>
                                    <span style={{
                                        fontWeight: 800,
                                        color: 'var(--primary)',
                                        background: 'var(--primary-light)',
                                        padding: '0.2rem 0.75rem',
                                        borderRadius: 99,
                                        fontSize: '0.875rem',
                                    }}>
                                        {s.best_points ? s.best_points.toLocaleString('ar') : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent camels */}
                <div className="card">
                    <div className="section-title">
                        <div className="section-title-icon"><IconSparkles /></div>
                        <h2>آخر النياق المضافة</h2>
                    </div>
                    {(d.recent_camels || []).length === 0 ? (
                        <div className="empty-state" style={{ padding: '1.5rem' }}>
                            <p>لا توجد نياق مضافة بعد</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(d.recent_camels || []).map((c: any) => (
                                <div key={c.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.65rem 0.75rem',
                                    background: 'var(--bg)',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                }}>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: '50%',
                                        background: 'var(--primary-light)',
                                        border: '2px solid var(--primary-medium)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 800, color: 'var(--primary)', fontSize: '0.75rem', flexShrink: 0,
                                    }}>
                                        {c.number}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {c.name || `ناقة ${c.number}`}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {c.points ? `${c.points.toLocaleString('ar')} نقطة` : 'النقاط غير محددة'}
                                        </div>
                                    </div>
                                    <span className={`badge badge-${c.status === 'available' ? 'green' : c.status === 'sold' ? 'red' : 'yellow'}`}>
                                        {c.status === 'available' ? 'متوفرة' : c.status === 'sold' ? 'مباعة' : c.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
