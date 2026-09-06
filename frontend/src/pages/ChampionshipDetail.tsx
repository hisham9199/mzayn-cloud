import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { championshipApi } from '../api/client'
import { ATTR_NAMES, ATTRIBUTES, OptimizeResult } from '../types'

/* ─── SVG Icons ─── */
const IconTrophy = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/>
        <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0012 0V2z"/>
    </svg>
)
const IconTarget = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
)
const IconZap = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
)
const IconBalance = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <line x1="12" y1="3" x2="12" y2="21"/><path d="M3 9l9-6 9 6"/><path d="M3 15l9 6 9-6"/>
    </svg>
)
const IconClock = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
)
const IconPlay = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:18,height:18}}>
        <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
)
const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
        <polyline points="20 6 9 17 4 12"/>
    </svg>
)
const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
)
const IconArrowUp = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
        <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
    </svg>
)
const IconArrowDown = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
    </svg>
)
const IconHistory = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
    </svg>
)
const IconInfo = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
)
const IconTrendUp = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
    </svg>
)

export default function ChampionshipDetail() {
    const { id } = useParams<{ id: string }>()
    const champId = parseInt(id!)
    const [overrideSpacing, setOverrideSpacing] = useState<string>('')
    const [optimizationGoal, setOptimizationGoal] = useState<'balanced' | 'min_spacing' | 'max_points'>('balanced')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [currentIds, setCurrentIds] = useState('')
    const [timeLimitSec, setTimeLimitSec] = useState(60)
    const [selectedViewMode, setSelectedViewMode] = useState<'table' | 'chips'>('table')
    const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null)

    const { data: champ } = useQuery(['championship', champId], () =>
        championshipApi.list().then(r => {
            const found = r.data.find((c: any) => c.id === champId)
            if (found && found.required_spacing !== null && found.required_spacing !== undefined) {
                setOverrideSpacing(found.required_spacing.toString())
            }
            return found
        })
    )

    const { data: history = [] } = useQuery(['champ-results', champId], () =>
        championshipApi.results(champId).then(r => r.data)
    )

    const optimize = async () => {
        setLoading(true)
        try {
            const currentCamelIds = currentIds
                ? currentIds.split(',').map(s => parseInt(s.trim())).filter(Boolean)
                : undefined
            const reqSpacing = overrideSpacing !== '' && !isNaN(parseInt(overrideSpacing))
                ? parseInt(overrideSpacing) : null
            const res = await championshipApi.optimize(champId, {
                current_camel_ids: currentCamelIds,
                time_limit_seconds: timeLimitSec,
                required_spacing: reqSpacing,
                optimization_goal: optimizationGoal,
            })
            setResult(res.data)
            toast.success('تم حساب أفضل تشكيلة')
        } catch (e: any) {
            toast.error(e.response?.data?.detail || 'حدث خطأ في التحسين')
        } finally {
            setLoading(false)
        }
    }

    const statusColor = (s: string) =>
        s === 'OPTIMAL' ? 'var(--success)' : s === 'FEASIBLE' ? 'var(--warning)' : 'var(--danger)'
    const statusBg = (s: string) =>
        s === 'OPTIMAL' ? 'var(--success-light)' : s === 'FEASIBLE' ? 'var(--warning-light)' : 'var(--danger-light)'
    const statusBorder = (s: string) =>
        s === 'OPTIMAL' ? 'var(--success-medium)' : s === 'FEASIBLE' ? 'var(--warning-medium)' : 'var(--danger-medium)'
    const statusLabel = (s: string) =>
        s === 'OPTIMAL' ? 'مثالي' : s === 'FEASIBLE' ? 'جيد' : 'لا يوجد حل'
    const statusIcon = (s: string) =>
        s === 'OPTIMAL' ? <IconCheck /> : s === 'FEASIBLE' ? <IconInfo /> : <IconX />

    const GOALS = [
        {
            id: 'balanced',
            label: 'متوازن',
            desc: 'توازن بين نقاط عالية وتباعد منخفض',
            icon: <IconBalance />,
        },
        {
            id: 'min_spacing',
            label: 'أقل تباعد',
            desc: 'أولوية لتماثل الصفات السبع',
            icon: <IconTarget />,
        },
        {
            id: 'max_points',
            label: 'أعلى نقاط',
            desc: 'أقصى مجموع نقاط ممكن',
            icon: <IconTrophy />,
        },
    ]

    return (
        <div className="animate-fadeIn">
            {/* Page Header */}
            <div className="page-top">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                            background: 'var(--warning-light)', border: '1px solid var(--warning-medium)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)',
                        }}>
                            <IconTrophy />
                        </div>
                        <h1>{champ?.name || 'البطولة'}</h1>
                    </div>
                    {champ && (
                        <p className="page-subtitle">
                            {champ.stable_name ? `المنقية: ${champ.stable_name}` : ''}{champ.stable_name ? ' · ' : ''}
                            النياق: {champ.min_camels}–{champ.max_camels}
                            {champ.required_spacing !== null && champ.required_spacing !== undefined
                                ? ` · التباعد المطلوب: ${champ.required_spacing}` : ''}
                        </p>
                    )}
                </div>
            </div>

            {/* Optimization Config */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <div className="section-title">
                    <div className="section-title-icon"><IconTarget /></div>
                    <h2>إعدادات التحسين</h2>
                </div>

                {/* Goal Selection */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <label className="form-label" style={{ marginBottom: '0.6rem', display: 'block' }}>
                        هدف الخوارزمية (الاستراتيجية)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.6rem' }}>
                        {GOALS.map(opt => {
                            const isActive = optimizationGoal === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setOptimizationGoal(opt.id as any)}
                                    style={{
                                        padding: '0.85rem',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                                        background: isActive ? 'var(--primary-light)' : 'var(--bg)',
                                        color: isActive ? 'var(--primary)' : 'var(--text)',
                                        textAlign: 'right',
                                        cursor: 'pointer',
                                        transition: 'all 150ms ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                        minHeight: 44,
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-secondary)' }}>
                                            {opt.icon}
                                        </span>
                                        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{opt.label}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: isActive ? 'var(--primary)' : 'var(--text-muted)', opacity: 0.9 }}>
                                        {opt.desc}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label">التباعد المطلوب / الحد الأقصى (اختياري)</label>
                        <input
                            className="form-control"
                            type="number"
                            value={overrideSpacing}
                            onChange={e => setOverrideSpacing(e.target.value)}
                            placeholder="بدون حد (أو أدخل رقم مثلاً: 1)"
                            min={0}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">التشكيلة الحالية (أرقام IDs - لمقارنتها)</label>
                        <input className="form-control" value={currentIds}
                            onChange={e => setCurrentIds(e.target.value)}
                            placeholder="مثال: 7, 20, 21, 23" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">الحد الأقصى للوقت (ثانية)</label>
                        <input className="form-control" type="number"
                            value={timeLimitSec}
                            onChange={e => setTimeLimitSec(parseInt(e.target.value))}
                            min={10} max={300} />
                    </div>
                </div>

                <button
                    className="btn btn-primary btn-lg"
                    onClick={optimize}
                    disabled={loading}
                    style={{ width: '100%', justifyContent: 'center', gap: '0.6rem' }}
                >
                    {loading ? (
                        <><div className="spinner" style={{ width: 20, height: 20 }} /> جاري حساب أفضل تشكيلة...</>
                    ) : (
                        <><IconPlay /> تشغيل محرك التحسين (OR-Tools)</>
                    )}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Status Header */}
                    <div className="result-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                padding: '0.3rem 0.85rem', borderRadius: 99, fontWeight: 700, fontSize: '0.875rem',
                                background: statusBg(result.solve_status || ''),
                                color: statusColor(result.solve_status || ''),
                                border: `1px solid ${statusBorder(result.solve_status || '')}`,
                            }}>
                                {statusIcon(result.solve_status || '')}
                                {statusLabel(result.solve_status || '')}
                            </span>
                            {result.solve_time_ms && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <IconClock />
                                    {(result.solve_time_ms / 1000).toFixed(2)} ثانية
                                </span>
                            )}
                        </div>

                        {result.solve_status === 'INFEASIBLE' ? (
                            <div className="validation-alert error" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
                                <strong>لا يوجد حل مناسب</strong>
                                <span>{result.message || 'لم يُعثر على تشكيلة مناسبة'}</span>
                                <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                    <IconInfo />
                                    جرب تغيير استراتيجية التحسين أو تخفيف شرط التباعد
                                </span>
                            </div>
                        ) : (
                            <>
                                {/* Spacing relaxed warning */}
                                {(result as any).spacing_constraint_relaxed && (
                                    <div className="validation-alert warning" style={{ marginBottom: '1rem' }}>
                                        <IconInfo />
                                        {(result as any).message}
                                    </div>
                                )}

                                {/* Main stats */}
                                <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
                                    {[
                                        { label: 'عدد النياق', value: result.num_camels, color: 'var(--info)', bg: 'var(--info-light)' },
                                        { label: 'إجمالي النقاط', value: result.total_points?.toLocaleString('ar'), color: 'var(--primary)', bg: 'var(--primary-light)' },
                                        {
                                            label: 'التباعد النهائي',
                                            value: result.final_spacing,
                                            color: result.final_spacing === 0 ? 'var(--success)' : 'var(--warning)',
                                            bg: result.final_spacing === 0 ? 'var(--success-light)' : 'var(--warning-light)',
                                        },
                                        {
                                            label: 'الحالة',
                                            value: statusLabel(result.solve_status || ''),
                                            color: statusColor(result.solve_status || ''),
                                            bg: statusBg(result.solve_status || ''),
                                        },
                                    ].map(s => (
                                        <div key={s.label} style={{
                                            textAlign: 'center', padding: '0.85rem',
                                            background: s.bg, borderRadius: 'var(--radius-sm)',
                                            border: `1px solid ${s.color}30`,
                                        }}>
                                            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: s.color, lineHeight: 1 }}>
                                                {s.value}
                                            </div>
                                            <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                                                {s.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Attribute sums */}
                                {result.attr_sums && (
                                    <div>
                                        <h4 style={{ color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.825rem', fontWeight: 600 }}>
                                            مجاميع الصفات
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.5rem' }}>
                                            {ATTRIBUTES.map(attr => {
                                                const val = result.attr_sums?.[attr]
                                                const vals = Object.values(result.attr_sums || {}) as number[]
                                                const isEqual = vals.every(v => v === vals[0])
                                                return (
                                                    <div key={attr} style={{
                                                        textAlign: 'center', padding: '0.6rem 0.25rem',
                                                        background: isEqual ? 'var(--success-light)' : 'var(--bg)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        border: `1px solid ${isEqual ? 'var(--success-medium)' : 'var(--border)'}`,
                                                    }}>
                                                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isEqual ? 'var(--success)' : 'var(--text)' }}>
                                                            {val?.toLocaleString('ar') ?? '—'}
                                                        </div>
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                            {ATTR_NAMES[attr as keyof typeof ATTR_NAMES]}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* In / Out comparison */}
                    {result.camels_to_remove !== undefined && (result.camels_to_remove.length > 0 || result.camels_to_add!.length > 0) && (
                        <div className="grid-2">
                            {[
                                { label: 'أخرج من التشكيلة', ids: result.camels_to_remove || [], color: 'var(--danger)', bg: 'var(--danger-light)', border: 'var(--danger-medium)', icon: <IconArrowDown /> },
                                { label: 'أدخل للتشكيلة', ids: result.camels_to_add || [], color: 'var(--success)', bg: 'var(--success-light)', border: 'var(--success-medium)', icon: <IconArrowUp /> },
                            ].map(g => (
                                <div key={g.label} className="card" style={{ borderColor: g.border }}>
                                    <h4 style={{ color: g.color, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}>
                                        <span style={{ background: g.bg, padding: '0.25rem', borderRadius: 6 }}>{g.icon}</span>
                                        {g.label}
                                    </h4>
                                    {g.ids.length === 0
                                        ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>لا تغيير</p>
                                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {g.ids.map((id: number) => (
                                                <span key={id} className="chip" style={{ borderColor: g.border, color: g.color, background: g.bg }}>
                                                    #{id}
                                                </span>
                                            ))}
                                        </div>
                                    }
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Score comparison */}
                    {result.current_total_points !== undefined && (
                        <div className="card" style={{ borderColor: 'var(--primary-medium)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                                <div className="section-title-icon"><IconTrendUp /></div>
                                <h4 style={{ fontSize: '0.925rem', fontWeight: 700 }}>مقارنة النتائج</h4>
                            </div>
                            <div className="grid-3">
                                {[
                                    { label: 'النتيجة الحالية', value: result.current_total_points, color: 'var(--text-secondary)', bg: 'var(--bg)' },
                                    { label: 'أفضل نتيجة', value: result.total_points, color: 'var(--primary)', bg: 'var(--primary-light)' },
                                    {
                                        label: 'الزيادة',
                                        value: `+${result.improvement?.toLocaleString('ar')}`,
                                        color: (result.improvement ?? 0) > 0 ? 'var(--success)' : 'var(--text-muted)',
                                        bg: (result.improvement ?? 0) > 0 ? 'var(--success-light)' : 'var(--bg)',
                                    },
                                ].map(s => (
                                    <div key={s.label} style={{ textAlign: 'center', padding: '0.75rem', background: s.bg, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.35rem', color: s.color, lineHeight: 1 }}>
                                            {typeof s.value === 'number' ? s.value.toLocaleString('ar') : s.value}
                                        </div>
                                        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Selected camels */}
                    {result.selected_camels && result.selected_camels.length > 0 && (
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🐪</span>
                                    <h4 style={{ color: 'var(--text)', margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                                        النياق المختارة في التشكيلة ({result.selected_camels.length})
                                    </h4>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <button
                                        className={`btn btn-sm ${selectedViewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setSelectedViewMode(m => m === 'table' ? 'chips' : 'table')}
                                        style={{ gap: '0.4rem', fontWeight: 600 }}
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                                            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                                            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                                        </svg>
                                        {selectedViewMode === 'table' ? 'عرض مختصر' : '📋 إظهار كافة الصفات'}
                                    </button>
                                </div>
                            </div>

                            {selectedViewMode === 'table' ? (
                                <SelectedCamelsTable
                                    camels={result.selected_camels}
                                    finalSpacing={result.final_spacing}
                                    totalPoints={result.total_points}
                                />
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    {result.selected_camels.map((c: any) => (
                                        <span key={c.id} className="chip" style={{
                                            background: 'var(--primary-light)',
                                            border: '1px solid var(--primary-medium)',
                                            color: 'var(--primary)',
                                            fontWeight: 600,
                                        }}>
                                            {c.number} {c.name ? `(${c.name})` : ''} · {c.points?.toLocaleString('ar')}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* History */}
            {history.length > 0 && (
                <div className="card" style={{ marginTop: '1.5rem' }}>
                    <div className="section-title">
                        <div className="section-title-icon"><IconHistory /></div>
                        <h2>سجل الحسابات السابقة</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {history.map((r: any) => (
                            <div key={r.id} style={{
                                background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)', padding: '0.75rem 0.85rem',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    fontSize: '0.85rem', flexWrap: 'wrap',
                                }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        padding: '0.15rem 0.6rem', borderRadius: 99, fontWeight: 700, fontSize: '0.78rem',
                                        background: statusBg(r.solve_status),
                                        color: statusColor(r.solve_status),
                                        border: `1px solid ${statusBorder(r.solve_status)}`,
                                    }}>
                                        {statusIcon(r.solve_status)}
                                        {statusLabel(r.solve_status)}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>{r.num_camels} نياق</span>
                                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                                        {r.total_points?.toLocaleString('ar')} نقطة
                                    </span>
                                    <span style={{ color: 'var(--text-muted)' }}>تباعد: {r.final_spacing}</span>
                                    <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        <IconClock />
                                        {new Date(r.created_at).toLocaleString('ar-SA')}
                                    </span>
                                    {r.selected_camels && r.selected_camels.length > 0 && (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                                            onClick={() => setExpandedHistoryId(expandedHistoryId === r.id ? null : r.id)}
                                        >
                                            {expandedHistoryId === r.id ? 'إخفاء الصفات' : '📋 عرض الصفات'}
                                        </button>
                                    )}
                                </div>
                                {expandedHistoryId === r.id && r.selected_camels && r.selected_camels.length > 0 && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <SelectedCamelsTable
                                            camels={r.selected_camels}
                                            finalSpacing={r.final_spacing}
                                            totalPoints={r.total_points}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

function SelectedCamelsTable({ camels, finalSpacing, totalPoints }: { camels: any[]; finalSpacing?: number; totalPoints?: number }) {
    const sumPoints = totalPoints ?? camels.reduce((acc, c) => acc + (c.points || 0), 0)
    const attrs = [
        { key: 'head', label: 'الرأس', isHead: true },
        { key: 'neck', label: 'الرقبة' },
        { key: 'lips', label: 'الشفاه' },
        { key: 'nose', label: 'الأنف' },
        { key: 'eyelashes', label: 'الرموش' },
        { key: 'ear', label: 'الأذن' },
        { key: 'hump', label: 'السنام' },
    ]

    return (
        <div className="table-wrap" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table>
                <thead>
                    <tr style={{ background: 'var(--bg)' }}>
                        <th style={{ textAlign: 'center', width: '45px' }}>#</th>
                        <th style={{ textAlign: 'center' }}>رقم الناقة</th>
                        <th style={{ textAlign: 'center' }}>الاسم</th>
                        <th style={{ textAlign: 'center', background: 'rgba(26, 82, 118, 0.08)', color: 'var(--primary)', fontWeight: 800 }}>النقاط</th>
                        <th style={{ textAlign: 'center' }}>التباعد</th>
                        <th style={{ textAlign: 'center' }}>التناسق</th>
                        {attrs.map(a => (
                            <th key={a.key} style={{
                                textAlign: 'center',
                                background: a.isHead ? 'rgba(212, 160, 23, 0.12)' : undefined,
                                color: a.isHead ? '#B45309' : undefined,
                                fontWeight: 700
                            }}>
                                {a.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {camels.map((c, idx) => (
                        <tr key={c.id || idx}>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                <span className="badge badge-gray" style={{ fontWeight: 700, fontSize: '0.85rem' }}>{c.number}</span>
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{c.name || '—'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--primary)', background: 'rgba(26, 82, 118, 0.04)' }}>
                                {c.points !== undefined && c.points !== null ? c.points.toLocaleString('ar') : '—'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                                <span className={`badge badge-${(c.spacing ?? 99) === 0 ? 'green' : (c.spacing ?? 99) <= 3 ? 'yellow' : 'red'}`}>
                                    {c.spacing ?? '—'}
                                </span>
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                {c.harmony !== undefined && c.harmony !== null ? Number(c.harmony).toFixed(1) : '—'}
                            </td>
                            {attrs.map(a => (
                                <td key={a.key} style={{
                                    textAlign: 'center',
                                    fontWeight: a.isHead ? 700 : 500,
                                    color: a.isHead ? '#92400E' : undefined,
                                    background: a.isHead ? 'rgba(252, 211, 77, 0.12)' : undefined,
                                }}>
                                    {c[a.key] ?? '—'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr style={{ background: 'var(--surface-hover)', fontWeight: 800, borderTop: '2px solid var(--border)' }}>
                        <td colSpan={3} style={{ textAlign: 'center', fontWeight: 800 }}>المجموع / المتوسط ({camels.length} نياق)</td>
                        <td style={{ textAlign: 'center', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 800 }}>
                            {sumPoints.toLocaleString('ar')}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--info)', fontWeight: 700 }}>
                            {finalSpacing !== undefined ? `تباعد ${finalSpacing}` : '—'}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                        {attrs.map(a => {
                            const sum = camels.reduce((acc, c) => acc + (Number(c[a.key]) || 0), 0)
                            const avg = camels.length > 0 ? (sum / camels.length).toFixed(1) : '0'
                            return (
                                <td key={a.key} style={{ textAlign: 'center', fontSize: '0.8rem', background: a.isHead ? 'rgba(252, 211, 77, 0.15)' : undefined }}>
                                    <div style={{ fontWeight: 800, color: a.isHead ? '#92400E' : 'var(--text)' }}>{sum.toLocaleString('ar')}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>متوسط {avg}</div>
                                </td>
                            )
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
