import { useState } from 'react'
import { useQuery } from 'react-query'
import { camelApi, stableApi, championshipApi } from '../api/client'
import { Stable, Championship, ATTR_NAMES, ATTRIBUTES } from '../types'

export default function Analysis() {
    const [stableId, setStableId] = useState('')
    const [champId, setChampId] = useState('')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const { data: stables = [] } = useQuery('stables', () => stableApi.list().then(r => r.data))
    const { data: champs = [] } = useQuery('championships', () => championshipApi.list().then(r => r.data))

    const runAnalysis = async () => {
        if (!stableId) return
        setLoading(true)
        try {
            const res = await camelApi.analyze(parseInt(stableId), champId ? parseInt(champId) : undefined)
            setResult(res.data)
        } catch {
            // handle error
        } finally {
            setLoading(false)
        }
    }

    const filteredChamps = champs.filter((c: Championship) =>
        !stableId || String(c.stable_id) === stableId
    )

    return (
        <div className="animate-fadeIn">
            <div className="page-top">
                <div>
                    <h1>تحليل المنقية</h1>
                    <p className="page-subtitle">تعرف على أضعف النياق والصفات المطلوبة</p>
                </div>
            </div>

            {/* Config Card */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div className="section-title">
                    <div className="section-title-icon">⚙️</div>
                    <h2>إعدادات التحليل</h2>
                </div>
                <div className="grid-3" style={{ marginBottom: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">المنقية *</label>
                        <select className="form-control" value={stableId} onChange={e => setStableId(e.target.value)}>
                            <option value="">اختر المنقية</option>
                            {stables.map((s: Stable) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">البطولة (اختياري - لاستخدام تشكيلتها)</label>
                        <select className="form-control" value={champId} onChange={e => setChampId(e.target.value)}>
                            <option value="">جميع نياق المنقية</option>
                            {filteredChamps.map((c: Championship) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
                <button className="btn btn-primary" onClick={runAnalysis} disabled={!stableId || loading}>
                    {loading ? (
                        <><div className="spinner" style={{width:16,height:16}} /> جاري التحليل...</>
                    ) : (
                        <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            تشغيل التحليل
                        </>
                    )}
                </button>
            </div>

            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Weakest camels */}
                    {result.weakest_camels?.length > 0 && (
                        <div className="card">
                            <div className="section-title">
                                <div className="section-title-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>⬇</div>
                                <h2>أضعف النياق في التشكيلة</h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {result.weakest_camels.map((c: any, i: number) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.65rem 1rem', background: 'var(--bg)',
                                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>ناقة #{c.number || c.id}</span>
                                        <span className="badge badge-red">
                                            {c.points?.toLocaleString('ar')} نقطة
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weakest attributes */}
                    {result.weakest_attributes?.length > 0 && (
                        <div className="card">
                            <div className="section-title">
                                <div className="section-title-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>📉</div>
                                <h2>الصفات الأضعف (تحتاج تركيز في الإنتاج)</h2>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                {result.weakest_attributes.map((a: any) => (
                                    <div key={a.attr} style={{
                                        flex: '1 1 120px', textAlign: 'center', padding: '1rem',
                                        background: 'var(--danger-light)',
                                        border: '1px solid var(--danger-medium)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--danger)' }}>
                                            {a.avg.toFixed(1)}
                                        </div>
                                        <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{a.attr_ar}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>متوسط</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recommended specs */}
                    {result.recommended_specs && (
                        <div className="card" style={{ borderColor: 'var(--primary-medium)', background: 'linear-gradient(135deg, var(--primary-light) 0%, var(--surface) 100%)' }}>
                            <div className="section-title">
                                <div className="section-title-icon">🎯</div>
                                <h2>المواصفات المطلوبة في الناقة القادمة</h2>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 160px), 1fr))', gap: '0.75rem' }}>
                                {result.recommended_specs.points && (
                                    <div style={{ padding: '0.85rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>النقاط</div>
                                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>
                                            {result.recommended_specs.points.min.toLocaleString('ar')} – {result.recommended_specs.points.max.toLocaleString('ar')}
                                        </div>
                                    </div>
                                )}
                                {result.recommended_specs.spacing && (
                                    <div style={{ padding: '0.85rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>التباعد</div>
                                        <div style={{ fontWeight: 700, color: 'var(--info)', fontSize: '0.875rem' }}>
                                            {result.recommended_specs.spacing.min} – {result.recommended_specs.spacing.max}
                                        </div>
                                    </div>
                                )}
                                {ATTRIBUTES.map(attr => {
                                    const spec = result.recommended_specs[attr]
                                    if (!spec) return null
                                    return (
                                        <div key={attr} style={{ padding: '0.85rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary-medium)' }}>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                                {ATTR_NAMES[attr as keyof typeof ATTR_NAMES]}
                                            </div>
                                            <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>
                                                {spec.min} – {spec.max}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                متوسط: {spec.avg}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
