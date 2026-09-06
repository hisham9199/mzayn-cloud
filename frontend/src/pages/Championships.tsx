import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { championshipApi, stableApi } from '../api/client'
import { Stable, Championship } from '../types'

const IconTrophy = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6" /><path d="M18 9h1.5a2.5 2.5 0 000-5H18" />
        <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0012 0V2z" />
    </svg>
)

const IconEdit = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
)

const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6" /><path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
)

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

const IconPlay = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
)

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

function ChampionshipModal({ champ, onClose }: { champ?: Championship | null; onClose: () => void }) {
    const qc = useQueryClient()
    const { data: stables = [] } = useQuery('stables', () => stableApi.list().then(r => r.data))

    const [form, setForm] = useState({
        name: champ?.name || '',
        stable_id: champ?.stable_id || '',
        min_camels: champ?.min_camels || 50,
        max_camels: champ?.max_camels || 60,
        max_points_per_camel: champ?.max_points_per_camel || '',
        required_spacing: champ?.required_spacing ?? '',
        mandatory_camel_ids: (champ?.mandatory_camel_ids || []).join(', '),
        excluded_camel_ids: (champ?.excluded_camel_ids || []).join(', '),
        allow_males: champ?.allow_males ?? true,
        allow_other_stables: champ?.allow_other_stables ?? false,
    })

    const mutation = useMutation(
        () => {
            const data = {
                ...form,
                stable_id: form.stable_id ? parseInt(form.stable_id as string) : null,
                max_points_per_camel: form.max_points_per_camel ? parseInt(form.max_points_per_camel as string) : null,
                required_spacing: form.required_spacing !== '' ? parseInt(form.required_spacing as string) : null,
                mandatory_camel_ids: form.mandatory_camel_ids
                    ? form.mandatory_camel_ids.split(',').map(s => parseInt(s.trim())).filter(Boolean) : [],
                excluded_camel_ids: form.excluded_camel_ids
                    ? form.excluded_camel_ids.split(',').map(s => parseInt(s.trim())).filter(Boolean) : [],
            }
            return champ ? championshipApi.update(champ.id, data) : championshipApi.create(data)
        },
        {
            onSuccess: () => {
                qc.invalidateQueries('championships')
                toast.success(champ ? 'تم تحديث البطولة' : 'تم إنشاء البطولة')
                onClose()
            },
            onError: (e: any) => {
                toast.error(e.response?.data?.detail || 'حدث خطأ')
            },
        }
    )

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 680 }}>
                <div className="modal-header">
                    <h3>{champ ? 'تعديل البطولة' : 'بطولة جديدة'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق">
                        <IconX />
                    </button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label">اسم البطولة *</label>
                            <input className="form-control" value={form.name}
                                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                placeholder="مسمى البطولة" autoFocus />
                        </div>
                        <div className="form-group">
                            <label className="form-label">المنقية</label>
                            <select className="form-control" value={form.stable_id}
                                onChange={e => setForm(p => ({ ...p, stable_id: e.target.value }))}>
                                <option value="">اختر المنقية</option>
                                {stables.map((s: Stable) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <h4 style={{ color: 'var(--text)', marginBottom: '0.85rem', fontSize: '0.875rem' }}>حدود التشكيلة</h4>
                        <div className="grid-4">
                            <div className="form-group">
                                <label className="form-label">الحد الأدنى للنياق</label>
                                <input className="form-control" type="number"
                                    value={form.min_camels}
                                    onChange={e => setForm(p => ({ ...p, min_camels: parseInt(e.target.value) }))} min={1} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">الحد الأعلى للنياق</label>
                                <input className="form-control" type="number"
                                    value={form.max_camels}
                                    onChange={e => setForm(p => ({ ...p, max_camels: parseInt(e.target.value) }))} min={1} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">حد النقاط للناقة</label>
                                <input className="form-control" type="number"
                                    value={form.max_points_per_camel}
                                    onChange={e => setForm(p => ({ ...p, max_points_per_camel: e.target.value }))}
                                    placeholder="بدون حد" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">التباعد المطلوب</label>
                                <input className="form-control" type="number"
                                    value={form.required_spacing}
                                    onChange={e => setForm(p => ({ ...p, required_spacing: e.target.value }))}
                                    placeholder="بدون شرط" min={0} />
                                {(form.required_spacing === '0' || form.required_spacing === 0) && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--warning)' }}>
                                        تباعد صفر يتطلب تساوي جميع الصفات
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group">
                            <label className="form-label">نياق إجبارية (IDs مفصولة بفواصل)</label>
                            <input className="form-control" value={form.mandatory_camel_ids}
                                onChange={e => setForm(p => ({ ...p, mandatory_camel_ids: e.target.value }))}
                                placeholder="1, 5, 12, ..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">نياق مستبعدة (IDs مفصولة بفواصل)</label>
                            <input className="form-control" value={form.excluded_camel_ids}
                                onChange={e => setForm(p => ({ ...p, excluded_camel_ids: e.target.value }))}
                                placeholder="7, 23, ..." />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        {[
                            { key: 'allow_males', label: 'السماح بالذكور' },
                            { key: 'allow_other_stables', label: 'السماح بنياق منقيات أخرى' },
                        ].map(opt => (
                            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', minHeight: 44 }}>
                                <input type="checkbox"
                                    checked={form[opt.key as keyof typeof form] as boolean}
                                    onChange={e => setForm(p => ({ ...p, [opt.key]: e.target.checked }))}
                                    style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                    <button className="btn btn-primary" onClick={() => mutation.mutate()}
                        disabled={!form.name.trim() || mutation.isLoading}>
                        {mutation.isLoading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> جاري الحفظ...</> : 'حفظ'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function Championships() {
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [modal, setModal] = useState<{ open: boolean; champ?: Championship | null }>({ open: false })
    const { data: champs = [], isLoading } = useQuery('championships', () => championshipApi.list().then(r => r.data))

    const deleteMut = useMutation((id: number) => championshipApi.delete(id), {
        onSuccess: () => {
            qc.invalidateQueries('championships')
            toast.success('تم حذف البطولة')
        },
        onError: () => {
            toast.error('حدث خطأ أثناء الحذف')
        },
    })

    return (
        <div className="animate-fadeIn">
            <div className="page-top">
                <div>
                    <h1>البطولات</h1>
                    <p className="page-subtitle">إنشاء وإدارة بطولات مزاين</p>
                </div>
                <div className="page-top-actions">
                    <button className="btn btn-primary" onClick={() => setModal({ open: true, champ: null })}>
                        <IconPlus />
                        بطولة جديدة
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ width: 36, height: 36 }} />
                </div>
            ) : champs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        <IconTrophy />
                    </div>
                    <h3 style={{ marginBottom: '0.5rem' }}>لا توجد بطولات</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>أنشئ بطولتك الأولى</p>
                    <button className="btn btn-primary" onClick={() => setModal({ open: true, champ: null })}>إنشاء بطولة</button>
                </div>
            ) : (
                <div className="grid-3">
                    {champs.map((c: any) => (
                        <div
                            key={c.id}
                            className="card"
                            style={{ cursor: 'pointer', position: 'relative', transition: 'all 200ms ease' }}
                            onClick={() => navigate(`/championships/${c.id}`)}
                        >
                            {/* Actions */}
                            <div style={{ position: 'absolute', top: '0.85rem', left: '0.85rem', display: 'flex', gap: '0.25rem' }}
                                onClick={e => e.stopPropagation()}>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModal({ open: true, champ: c })} aria-label="تعديل">
                                    <IconEdit />
                                </button>
                                <button className="btn btn-danger btn-icon btn-sm" aria-label="حذف"
                                    onClick={() => window.confirm(`حذف "${c.name}"؟`) && deleteMut.mutate(c.id)}>
                                    <IconTrash />
                                </button>
                            </div>

                            {/* Trophy icon */}
                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{
                                    width: 44, height: 44,
                                    background: 'var(--warning-light)',
                                    border: '1px solid var(--warning-medium)',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--warning)',
                                }}>
                                    <IconTrophy />
                                </div>
                            </div>

                            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.25rem', paddingLeft: '4.5rem' }}>
                                {c.name}
                            </div>
                            {c.stable_name && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                                    {c.stable_name}
                                </div>
                            )}

                            <div className="divider" />

                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>النياق: </span>
                                    <strong>{c.min_camels}—{c.max_camels}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>التباعد: </span>
                                    <strong style={{ color: c.required_spacing === 0 ? 'var(--success)' : 'var(--text)' }}>
                                        {c.required_spacing ?? 'بدون شرط'}
                                    </strong>
                                </div>
                                {c.max_points_per_camel && (
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>حد النقاط: </span>
                                        <strong>{c.max_points_per_camel.toLocaleString('ar')}</strong>
                                    </div>
                                )}
                            </div>

                            <div style={{
                                marginTop: '0.85rem', fontSize: '0.8rem',
                                color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.3rem',
                            }}>
                                <IconPlay />
                                انقر لتشغيل التحسين
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal.open && <ChampionshipModal champ={modal.champ} onClose={() => setModal({ open: false })} />}
        </div>
    )
}
