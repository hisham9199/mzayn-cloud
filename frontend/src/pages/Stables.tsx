import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { stableApi } from '../api/client'
import { Stable } from '../types'

const IconBuilding = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
    </svg>
)

const IconEdit = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
)

const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
)

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

function StableModal({ stable, onClose }: { stable?: Stable | null; onClose: () => void }) {
    const qc = useQueryClient()
    const [name, setName] = useState(stable?.name || '')
    const [desc, setDesc] = useState(stable?.description || '')

    const mutation = useMutation(
        () => stable
            ? stableApi.update(stable.id, { name, description: desc })
            : stableApi.create({ name, description: desc }),
        {
            onSuccess: () => {
                qc.invalidateQueries('stables')
                toast.success(stable ? 'تم تحديث المنقية' : 'تم إنشاء المنقية')
                onClose()
            },
            onError: (e: any) => {
                toast.error(e.response?.data?.detail || 'حدث خطأ')
            },
        }
    )

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3>{stable ? 'تعديل المنقية' : 'إنشاء منقية جديدة'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق">
                        <IconX />
                    </button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">اسم المنقية *</label>
                            <input
                                className="form-control"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="مثال: صاد، الحداري، الحمر..."
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">وصف (اختياري)</label>
                            <textarea
                                className="form-control"
                                value={desc}
                                onChange={e => setDesc(e.target.value)}
                                placeholder="وصف المنقية..."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => mutation.mutate()}
                        disabled={!name.trim() || mutation.isLoading}
                    >
                        {mutation.isLoading ? (
                            <><div className="spinner" style={{ width: 16, height: 16 }} /> جاري الحفظ...</>
                        ) : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function Stables() {
    const qc = useQueryClient()
    const [modal, setModal] = useState<{ open: boolean; stable?: Stable | null }>({ open: false })
    const { data: stables = [], isLoading } = useQuery('stables', () => stableApi.list().then(r => r.data))

    const deleteMut = useMutation((id: number) => stableApi.delete(id), {
        onSuccess: () => {
            qc.invalidateQueries('stables')
            toast.success('تم حذف المنقية')
        },
        onError: (e: any) => {
            toast.error(e.response?.data?.detail || 'لا يمكن الحذف')
        },
    })

    return (
        <div className="animate-fadeIn">
            <div className="page-top">
                <div>
                    <h1>المنقيات</h1>
                    <p className="page-subtitle">إدارة منقيات النياق</p>
                </div>
                <div className="page-top-actions">
                    <button className="btn btn-primary" onClick={() => setModal({ open: true, stable: null })}>
                        <IconPlus />
                        منقية جديدة
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ width: 36, height: 36 }} />
                </div>
            ) : stables.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        <IconBuilding />
                    </div>
                    <h3 style={{ marginBottom: '0.5rem' }}>لا توجد منقيات</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                        أنشئ منقيتك الأولى للبدء في إدارة النياق
                    </p>
                    <button className="btn btn-primary" onClick={() => setModal({ open: true, stable: null })}>
                        إنشاء منقية
                    </button>
                </div>
            ) : (
                <div className="grid-3">
                    {stables.map((s: Stable) => (
                        <div key={s.id} className="card" style={{ transition: 'all 200ms ease' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 'var(--radius-sm)',
                                        background: 'var(--primary-light)',
                                        border: '1px solid var(--primary-medium)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--primary)', flexShrink: 0,
                                    }}>
                                        <IconBuilding />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {s.name}
                                        </div>
                                        {s.description && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {s.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                    <button
                                        className="btn btn-ghost btn-icon btn-sm"
                                        onClick={() => setModal({ open: true, stable: s })}
                                        aria-label="تعديل"
                                    >
                                        <IconEdit />
                                    </button>
                                    <button
                                        className="btn btn-danger btn-icon btn-sm"
                                        aria-label="حذف"
                                        onClick={() => window.confirm(`حذف منقية "${s.name}"؟`) && deleteMut.mutate(s.id)}
                                    >
                                        <IconTrash />
                                    </button>
                                </div>
                            </div>
                            <div className="divider" />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                                        {(s.camel_count ?? 0).toLocaleString('ar')}
                                    </div>
                                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>نياق مسجلة</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal.open && <StableModal stable={modal.stable} onClose={() => setModal({ open: false })} />}
        </div>
    )
}
