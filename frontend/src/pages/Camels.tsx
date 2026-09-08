import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import toast from 'react-hot-toast'
import { camelApi, stableApi, ocrApi, championshipApi } from '../api/client'
import { Camel, Stable, ATTRIBUTES, ATTR_NAMES, GENDER_OPTIONS, STATUS_LABELS, computeExpected } from '../types'

/* ─── Vector SVG Icons ─── */
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

const IconFlask = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <path d="M9.5 2v4.5l-5.7 10.3A2 2 0 005.5 20h13a2 2 0 001.7-3.2L14.5 6.5V2h-5z" />
        <line x1="8.5" y1="2" x2="15.5" y2="2" />
        <line x1="7" y1="14" x2="17" y2="14" />
    </svg>
)

const IconHistory = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
)

const IconCamera = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
)

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
)

const IconSearch = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, color: 'var(--text-muted)' }}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
)

const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
)

const IconAlert = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
)

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
)

const IconBuilding = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
        <path d="M3 21h18" />
        <path d="M5 21V7l8-4v18" />
        <path d="M19 21V11l-6-4" />
    </svg>
)

const IconZap = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
)

/* ----------- Validation Summary Component ----------- */
function ValidationSummary({ camel, onAutoFix }: { camel: Partial<Camel>; onAutoFix?: (expectedPoints: number, expectedSpacing: number) => void }) {
    const { expectedPoints, expectedSpacing } = computeExpected(camel)
    if (expectedPoints === null) return (
        <div className="validation-alert warning">
            <IconAlert />
            <span>يرجى إدخال جميع الصفات السبع للتحقق من المجموع والتباعد</span>
        </div>
    )

    const pointsOk = camel.points === expectedPoints
    const spacingOk = camel.spacing === expectedSpacing

    if (pointsOk && spacingOk)
        return (
            <div className="validation-alert success">
                <IconCheck />
                <span>البيانات صحيحة 100% — النقاط ({camel.points}) والتباعد ({camel.spacing}) متطابقان تماماً</span>
            </div>
        )

    return (
        <div className="validation-alert error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconAlert />
                <span>
                    {!pointsOk && `النقاط الصحيحة المحسوبة: ${expectedPoints} (المدخل: ${camel.points ?? 'فارغ'})`}
                    {!pointsOk && !spacingOk && ' | '}
                    {!spacingOk && `التباعد الصحيح المحسوب: ${expectedSpacing} (المدخل: ${camel.spacing ?? 'فارغ'})`}
                </span>
            </div>
            {onAutoFix && (
                <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem', gap: '0.3rem' }}
                    onClick={() => onAutoFix(expectedPoints, expectedSpacing)}
                >
                    <IconZap />
                    تصحيح وتطبيق تلقائي
                </button>
            )}
        </div>
    )
}

/* ----------- Camel Form Modal ----------- */
function CamelModal({ camel, onClose, initialData }: {
    camel?: Camel | null; onClose: () => void; initialData?: any
}) {
    const qc = useQueryClient()
    const { data: stables = [] } = useQuery('stables', () => stableApi.list().then(r => r.data))
    const isEdit = !!camel

    const [form, setForm] = useState<Partial<Camel>>(camel || {
        number: '', name: '', gender: 'أنثى', color: '', status: 'available',
        nose: undefined, lips: undefined, head: undefined, neck: undefined,
        hump: undefined, eyelashes: undefined, ear: undefined,
        points: undefined, spacing: undefined,
        ...initialData,
    })

    // Auto-compute points and spacing
    useEffect(() => {
        const attrs = ATTRIBUTES.map(a => form[a] as number)
        if (attrs.every(v => v && v > 0)) {
            const sum = attrs.reduce((a, b) => a + b, 0)
            const sp = Math.max(...attrs) - Math.min(...attrs)
            setForm(prev => ({ ...prev, points: sum, spacing: sp }))
        }
    }, [form.nose, form.lips, form.head, form.neck, form.hump, form.eyelashes, form.ear])

    const handleAttr = (key: string, val: string) => {
        setForm(prev => ({ ...prev, [key]: val ? parseInt(val) : undefined }))
    }

    const handleAutoFix = (pts: number, sp: number) => {
        setForm(prev => ({ ...prev, points: pts, spacing: sp }))
        toast.success(`تم ضبط النقاط إلى ${pts} والتباعد إلى ${sp}`)
    }

    const mutation = useMutation(
        () => {
            const payload = {
                ...form,
                number: form.number?.trim() || form.name?.trim() || 'ناقة جديدة',
            }
            return isEdit ? camelApi.update(camel!.id, payload) : camelApi.create(payload)
        },
        {
            onSuccess: (res) => {
                qc.invalidateQueries('camels')
                const data = res.data
                if (!data.is_valid) {
                    toast.error('تم الحفظ لكن البيانات تحتاج مراجعة - النقاط أو التباعد غير صحيح')
                } else {
                    toast.success(isEdit ? 'تم تحديث وتصحيح بيانات الناقة بنجاح' : 'تم حفظ الناقة بنجاح')
                }
                onClose()
            },
            onError: (e: any) => {
                const detail = e.response?.data?.detail
                const msg = typeof detail === 'string' ? detail : 'حدث خطأ أثناء الحفظ'
                toast.error(msg)
            },
        }
    )

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 780 }}>
                <div className="modal-header">
                    <h3>{isEdit ? `تصحيح ومراجعة بيانات ناقة ${camel!.number}` : 'إضافة ناقة جديدة'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق"><IconX /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {isEdit && (camel?.needs_review || !camel?.is_valid) && (
                        <div className="validation-alert warning">
                            <IconAlert />
                            <span>
                                <strong>تنبيه مراجعة:</strong> هذه الناقة تم وسمها للمراجعة. يمكنك تصحيح أي من أرقام الصفات السبع أدناه أو الضغط على <strong>(تصحيح وتطبيق تلقائي)</strong> لمطابقة النقاط والتباعد تلقائياً ثم اضغط حفظ.
                            </span>
                        </div>
                    )}
                    {/* Basic info */}
                    <div>
                        <h4 style={{ color: 'var(--text)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>البيانات التعريفية</h4>
                        <div className="grid-4">
                            <div className="form-group">
                                <label className="form-label">رقم الناقة *</label>
                                <input className="form-control" value={form.number || ''} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} placeholder="مثال: 13" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">الاسم</label>
                                <input className="form-control" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الناقة" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">الجنس</label>
                                <select className="form-control" value={form.gender || ''} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                                    <option value="">اختر</option>
                                    {GENDER_OPTIONS.map(g => <option key={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">اللون / السلالة</label>
                                <input className="form-control" value={form.color || ''} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} placeholder="حمر / صفر / شقح..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">المنقية</label>
                                <select className="form-control" value={form.stable_id || ''} onChange={e => setForm(p => ({ ...p, stable_id: e.target.value ? parseInt(e.target.value) : undefined }))}>
                                    <option value="">بدون منقية</option>
                                    {stables.map((s: Stable) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">المالك</label>
                                <input className="form-control" value={form.owner || ''} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))} placeholder="اسم المالك" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">الحالة</label>
                                <select className="form-control" value={form.status || 'available'} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">تاريخ الاقتناء</label>
                                <input className="form-control" type="date" value={form.acquisition_date || ''}
                                    onChange={e => setForm(p => ({ ...p, acquisition_date: e.target.value }))} />
                            </div>
                        </div>
                    </div>

                    {/* 7 Attributes */}
                    <div>
                        <h4 style={{ color: 'var(--text)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>الصفات السبع</h4>
                        <div className="attr-grid">
                            {ATTRIBUTES.map(attr => (
                                <div className="form-group" key={attr}>
                                    <label className="form-label">{ATTR_NAMES[attr as keyof typeof ATTR_NAMES]}</label>
                                    <input
                                        className="form-control"
                                        type="number" min={0} max={9999}
                                        value={form[attr as keyof Camel] as number || ''}
                                        onChange={e => handleAttr(attr, e.target.value)}
                                        placeholder="—"
                                        style={{ textAlign: 'center', fontWeight: 700 }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Computed values */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">النقاط (محسوبة تلقائياً)</label>
                            <input className={`form-control ${form.points && computeExpected(form).expectedPoints === form.points ? 'success' : 'warning'}`}
                                type="number" value={form.points || ''} onChange={e => setForm(p => ({ ...p, points: e.target.value ? parseInt(e.target.value) : undefined }))}
                                style={{ fontWeight: 800, color: 'var(--primary)' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">التباعد (محسوب تلقائياً)</label>
                            <input className={`form-control ${form.spacing !== undefined && computeExpected(form).expectedSpacing === form.spacing ? 'success' : 'warning'}`}
                                type="number" value={form.spacing ?? ''} onChange={e => setForm(p => ({ ...p, spacing: e.target.value ? parseInt(e.target.value) : undefined }))}
                                style={{ fontWeight: 800, color: 'var(--info)' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">التناسق العام</label>
                            <input className="form-control" type="number" step="0.1"
                                value={form.harmony || ''} onChange={e => setForm(p => ({ ...p, harmony: e.target.value ? parseFloat(e.target.value) : undefined }))}
                                placeholder="سيحسب تلقائياً" />
                        </div>
                    </div>

                    {/* Validation */}
                    <ValidationSummary camel={form} onAutoFix={handleAutoFix} />

                    {/* Notes */}
                    <div className="form-group">
                        <label className="form-label">ملاحظات</label>
                        <textarea className="form-control" value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="ملاحظات..." />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                    <button className="btn btn-primary" onClick={() => mutation.mutate()}
                        disabled={mutation.isLoading}>
                        {mutation.isLoading ? (
                            <><div className="spinner" style={{ width: 16, height: 16 }} /> جاري الحفظ...</>
                        ) : 'حفظ الناقة'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ----------- OCR Import Modal ----------- */
function OCRModal({ onClose, onData }: { onClose: () => void; onData: (data: any) => void }) {
    const qc = useQueryClient()
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [preview, setPreview] = useState<string | null>(null)

    const handleFile = (f: File) => {
        setFile(f)
        setPreview(URL.createObjectURL(f))
        setResult(null)
    }

    const runOCR = async () => {
        if (!file) return
        setLoading(true)
        try {
            const res = await ocrApi.single(file)
            setResult(res.data)
        } catch {
            toast.error('فشل استخراج البيانات')
        } finally {
            setLoading(false)
        }
    }

    const buildPayload = () => {
        if (!result) return null
        const d: any = {}
        ;['number', 'name', 'gender', 'color', 'points', 'spacing', ...ATTRIBUTES].forEach(f => {
            const v = result[f]?.value
            if (v) d[f] = ['points', 'spacing', ...ATTRIBUTES].includes(f) ? (parseInt(v) || undefined) : v
        })
        if (!d.number) {
            d.number = d.name || 'ناقة جديدة'
        }
        return d
    }

    const directSaveMutation = useMutation(
        async () => {
            const payload = buildPayload()
            if (!payload) throw new Error('لا توجد بيانات')
            return camelApi.create(payload)
        },
        {
            onSuccess: () => {
                qc.invalidateQueries('camels')
                toast.success('تم حفظ الناقة بنجاح')
                onClose()
            },
            onError: (e: any) => {
                const detail = e.response?.data?.detail
                const msg = typeof detail === 'string' ? detail : 'حدث خطأ أثناء الحفظ'
                toast.error(msg)
            }
        }
    )

    const statusColor = (s: string) => s === 'green' ? 'var(--success)' : s === 'yellow' ? 'var(--warning)' : 'var(--danger)'

    const getFieldValue = (field: string) => result?.[field]?.value || ''

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 820 }}>
                <div className="modal-header">
                    <h3>إضافة ناقة من صورة</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق"><IconX /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '1.25rem' }}>
                        {/* Left: Upload */}
                        <div>
                            <div className="dropzone" onClick={() => document.getElementById('ocr-file-input')?.click()}>
                                <input id="ocr-file-input" type="file" accept="image/*" style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                                {preview ? (
                                    <img src={preview} alt="preview" style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 8 }} />
                                ) : (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                                            <IconCamera />
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>اسحب صورة أو انقر للاختيار</p>
                                    </>
                                )}
                            </div>

                            {file && (
                                <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', gap: '0.4rem' }}
                                    onClick={runOCR} disabled={loading}>
                                    {loading ? (
                                        <><div className="spinner" style={{ width: 16, height: 16 }} /> جاري الاستخراج...</>
                                    ) : (
                                        <><IconSearch /> استخراج البيانات</>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Right: OCR Results */}
                        <div>
                            {!result ? (
                                <div className="empty-state" style={{ padding: '2rem 0' }}>
                                    <span style={{ color: 'var(--text-muted)' }}><IconSearch /></span>
                                    <p style={{ marginTop: '0.5rem' }}>ارفع صورة ثم اضغط استخراج</p>
                                </div>
                            ) : (
                                <>
                                    {/* Overall status */}
                                    <div className="validation-alert" style={{
                                        background: `${statusColor(result.overall_status)}15`,
                                        borderColor: `${statusColor(result.overall_status)}40`,
                                        color: statusColor(result.overall_status), marginBottom: '0.75rem'
                                    }}>
                                        {result.overall_status === 'green' ? <IconCheck /> : <IconAlert />}
                                        <span>
                                            {result.overall_status === 'green' ? 'البيانات صحيحة ومتطابقة 100%' :
                                                result.overall_status === 'yellow' ? 'تحقق من البيانات' : 'يوجد خطأ'}
                                            {` — ثقة: ${(result.overall_confidence * 100).toFixed(0)}%`}
                                        </span>
                                    </div>

                                    {/* Fields */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto' }}>
                                        {['name', 'points', 'spacing', ...ATTRIBUTES].map(field => {
                                            const r = result[field]
                                            if (!r) return null
                                            const fieldName = field === 'name' ? 'الاسم' : field === 'points' ? 'النقاط' : field === 'spacing' ? 'التباعد' : ATTR_NAMES[field as keyof typeof ATTR_NAMES] || field
                                            return (
                                                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ width: 60, fontSize: '0.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>{fieldName}</span>
                                                    <input className="form-control" style={{ flex: 1, padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                                                        value={getFieldValue(field)} readOnly placeholder="—" />
                                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(r.status), flexShrink: 0 }} />
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 30, flexShrink: 0 }}>
                                                        {(r.confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                    {result && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" onClick={() => {
                                const d = buildPayload()
                                onData(d)
                                onClose()
                            }}>
                                <IconEdit /> تعديل في النموذج
                            </button>
                            <button className="btn btn-primary" onClick={() => directSaveMutation.mutate()} disabled={directSaveMutation.isLoading}>
                                {directSaveMutation.isLoading ? 'جاري الحفظ...' : 'حفظ مباشر'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/* ----------- Audit Log Modal ----------- */
function AuditModal({ camel, onClose }: { camel: Camel; onClose: () => void }) {
    const { data: logs = [], isLoading } = useQuery(['audit', camel.id], () =>
        camelApi.audit(camel.id).then(r => r.data)
    )

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 650 }}>
                <div className="modal-header">
                    <h3>سجل تعديلات الناقة #{camel.number} {camel.name ? `(${camel.name})` : ''}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق"><IconX /></button>
                </div>
                <div className="modal-body">
                    {isLoading ? (
                        <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
                    ) : logs.length === 0 ? (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                            <p>لا يوجد سجل تعديلات سابق لهذه الناقة</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: 380, overflowY: 'auto' }}>
                            {logs.map((log: any) => (
                                <div key={log.id} style={{
                                    padding: '0.65rem 0.85rem', background: 'var(--bg)',
                                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.85rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                            {log.action === 'create' ? 'إنشاء الناقة' : log.action === 'delete' ? 'حذف' : `تعديل ${log.field}`}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {new Date(log.when).toLocaleString('ar-SA')}
                                        </span>
                                    </div>
                                    {log.field !== 'all' && (
                                        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            <div>القبل: <span style={{ color: 'var(--danger)' }}>{log.old || 'فارغ'}</span></div>
                                            <div>البعد: <span style={{ color: 'var(--success)' }}>{log.new || 'فارغ'}</span></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>إغلاق</button>
                </div>
            </div>
        </div>
    )
}

/* ----------- Test Camel Modal ----------- */
function TestCamelModal({ camel, onClose }: { camel: Camel; onClose: () => void }) {
    const { data: champs = [] } = useQuery('championships', () => championshipApi.list().then(r => r.data))
    const [selectedChamp, setSelectedChamp] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)

    const runTest = async () => {
        if (!selectedChamp) return
        setLoading(true)
        try {
            const res = await camelApi.test(camel.id, parseInt(selectedChamp))
            setResult(res.data)
        } catch (e: any) {
            toast.error(e.response?.data?.detail || 'حدث خطأ أثناء الاختبار')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 650 }}>
                <div className="modal-header">
                    <h3>اختبار الناقة #{camel.number} (هل الناقة تفيدني؟)</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق"><IconX /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="form-label">اختر البطولة للاختبار عليها</label>
                        <select className="form-control" value={selectedChamp} onChange={e => setSelectedChamp(e.target.value)}>
                            <option value="">-- اختر البطولة --</option>
                            {champs.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name} ({c.stable_name || 'بدون منقية'})</option>
                            ))}
                        </select>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', gap: '0.4rem' }} onClick={runTest} disabled={!selectedChamp || loading}>
                        {loading ? (
                            <><div className="spinner" style={{ width: 16, height: 16 }} /> جاري الحساب بـ OR-Tools...</>
                        ) : (
                            <><IconFlask /> تشغيل اختبار الناقة</>
                        )}
                    </button>

                    {result && (
                        <div style={{
                            marginTop: '1.25rem', padding: '1rem',
                            background: result.benefits_stable ? 'var(--success-light)' : 'var(--danger-light)',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${result.benefits_stable ? 'var(--success-medium)' : 'var(--danger-medium)'}`,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <span style={{ color: result.benefits_stable ? 'var(--success)' : 'var(--danger)' }}>
                                    {result.benefits_stable ? <IconCheck /> : <IconX />}
                                </span>
                                <h4 style={{ color: result.benefits_stable ? 'var(--success)' : 'var(--danger)', margin: 0, fontSize: '0.95rem' }}>
                                    تفيد المنقية: {result.benefits_stable ? 'نعم' : 'لا'}
                                </h4>
                            </div>
                            <p style={{ color: 'var(--text)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
                                {result.message}
                            </p>
                            <div className="grid-3" style={{ gap: '0.5rem', textAlign: 'center' }}>
                                <div style={{ background: 'var(--surface)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>النتيجة الحالية</div>
                                    <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: '0.2rem' }}>{result.current_best_points?.toLocaleString('ar')}</div>
                                </div>
                                <div style={{ background: 'var(--surface)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>بعد إضافة الناقة</div>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginTop: '0.2rem' }}>{result.new_best_points?.toLocaleString('ar')}</div>
                                </div>
                                <div style={{ background: 'var(--surface)', padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>الزيادة</div>
                                    <div style={{ fontWeight: 700, color: result.improvement > 0 ? 'var(--success)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        +{result.improvement?.toLocaleString('ar')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>إغلاق</button>
                </div>
            </div>
        </div>
    )
}

/* ----------- Bulk Assign Modal ----------- */
function BulkAssignModal({
    camelIds,
    stables,
    onClose,
    onSuccess,
}: {
    camelIds: number[]
    stables: Stable[]
    onClose: () => void
    onSuccess: () => void
}) {
    const qc = useQueryClient()
    const [selectedStableId, setSelectedStableId] = useState<string>('')
    const [newStableName, setNewStableName] = useState<string>('')
    const [selectedStatus, setSelectedStatus] = useState<string>('')

    const mutation = useMutation(
        async () => {
            if (!selectedStableId && !newStableName.trim() && !selectedStatus) {
                throw new Error('يرجى اختيار منقية أو كتابة اسم منقية جديدة')
            }
            return camelApi.bulkAssign({
                camel_ids: camelIds,
                stable_id: selectedStableId ? parseInt(selectedStableId) : undefined,
                new_stable_name: newStableName.trim() || undefined,
                status: selectedStatus || undefined,
            })
        },
        {
            onSuccess: (res: any) => {
                qc.invalidateQueries('camels')
                qc.invalidateQueries('stables')
                toast.success(res.data?.message || 'تم نقل النياق إلى المنقية بنجاح')
                onSuccess()
                onClose()
            },
            onError: (e: any) => {
                toast.error(e.response?.data?.detail || e.message || 'حدث خطأ أثناء التعيين')
            },
        }
    )

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3>تعيين منقية للمجموعة المحددة ({camelIds.length} ناقة)</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="إغلاق"><IconX /></button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="form-group">
                        <label className="form-label">اختر منقية حالية:</label>
                        <select className="form-control" value={selectedStableId} onChange={e => {
                            setSelectedStableId(e.target.value)
                            if (e.target.value) setNewStableName('')
                        }}>
                            <option value="">-- اختر منقية --</option>
                            {stables.map((s: Stable) => (
                                <option key={s.id} value={s.id}>{s.name} ({s.camel_count || 0} ناقة)</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>— أو —</div>

                    <div className="form-group">
                        <label className="form-label">إنشاء منقية جديدة ونقل النياق إليها (مثال: صاد):</label>
                        <input
                            className="form-control"
                            placeholder="اسم المنقية الجديدة، مثلاً: صاد"
                            value={newStableName}
                            onChange={e => {
                                setNewStableName(e.target.value)
                                if (e.target.value) setSelectedStableId('')
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">تحديث حالة النياق (اختياري):</label>
                        <select className="form-control" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                            <option value="">بدون تغيير الحالة</option>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                    <button
                        className="btn btn-primary"
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isLoading || (!selectedStableId && !newStableName.trim() && !selectedStatus)}
                    >
                        {mutation.isLoading ? 'جاري النقل...' : `نقل (${camelIds.length}) ناقة`}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ----------- Camel Status Badge ----------- */
function CamelStatusBadge({ camel }: { camel: Camel }) {
    const hasZeroOrMissing = ATTRIBUTES.some(a => {
        const val = camel[a as keyof Camel]
        return val === undefined || val === null || (val as number) <= 0
    })
    if (!hasZeroOrMissing && camel.is_valid) return <span className="badge badge-green">صحيح</span>
    if (camel.needs_review || hasZeroOrMissing) return <span className="badge badge-yellow">مراجعة</span>
    return <span className="badge badge-red">خطأ</span>
}

/* ----------- Main Camels Page ----------- */
export default function Camels() {
    const qc = useQueryClient()
    const [modal, setModal] = useState<{ type: 'edit' | 'add' | 'ocr' | 'audit' | 'test' | null; camel?: Camel | null; initialData?: any }>({ type: null })
    const [search, setSearch] = useState('')
    const [filters, setFilters] = useState({ stable_id: '', status: '', gender: '', is_valid: '' })
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
    const [showBulkModal, setShowBulkModal] = useState(false)
    const [showSelectedModal, setShowSelectedModal] = useState(false)

    const { data: stables = [] } = useQuery('stables', () => stableApi.list().then(r => r.data))
    const { data: camels = [], isLoading } = useQuery(
        ['camels', search, filters],
        () => camelApi.list({ search: search || undefined, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }).then(r => r.data),
        { keepPreviousData: true }
    )

    const toggleSelect = (id: number) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const toggleSelectAll = () => {
        if (camels.length > 0 && selectedIds.size === camels.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(camels.map(c => c.id)))
        }
    }

    const deleteMut = useMutation(
        (id: number) => camelApi.delete(id),
        {
            onSuccess: () => {
                qc.invalidateQueries('camels')
                qc.invalidateQueries('dashboard')
                toast.success('تم حذف الناقة')
                return
            },
            onError: () => {
                toast.error('فشل حذف الناقة')
            }
        }
    )

    const bulkDeleteMut = useMutation(
        async () => {
            return await camelApi.bulkDelete({ camel_ids: Array.from(selectedIds) })
        },
        {
            onSuccess: () => {
                qc.invalidateQueries('camels')
                qc.invalidateQueries('dashboard')
                qc.invalidateQueries('stables')
                toast.success(`تم حذف ${selectedIds.size} ناقة بنجاح`)
                setSelectedIds(new Set())
                return
            },
            onError: () => {
                toast.error('فشل حذف النياق')
            }
        }
    )

    return (
        <div className="animate-fadeIn">
            {/* Header */}
            <div className="page-top">
                <div>
                    <h1>النياق</h1>
                    <p className="page-subtitle">
                        {camels.length} ناقة {selectedIds.size > 0 && `(محدد ${selectedIds.size})`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={() => setModal({ type: 'ocr' })}>
                        <IconCamera /> مسح OCR
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}>
                        <IconPlus /> إضافة ناقة
                    </button>
                </div>
            </div>

            {/* Bulk Actions Banner */}
            {selectedIds.size > 0 && (
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1.25rem',
                    background: 'var(--primary-light)',
                    border: '1px solid var(--primary-medium)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>
                            تم تحديد {selectedIds.size} ناقة
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowSelectedModal(true)} style={{ gap: '0.4rem', fontWeight: 600 }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                            </svg>
                            إظهار صفات النياق المختارة ({selectedIds.size})
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowBulkModal(true)}>
                            <IconBuilding /> نقل إلى منقية
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} ناقة محددة؟`)) {
                                bulkDeleteMut.mutate()
                            }
                        }} disabled={bulkDeleteMut.isLoading}>
                            <IconTrash /> حذف المحدد ({selectedIds.size})
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
                            إلغاء التحديد
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="card" style={{ marginBottom: '1rem', padding: '0.85rem 1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                        className={`btn btn-sm ${!filters.is_valid ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilters(p => ({ ...p, is_valid: '' }))}>
                        جميع النياق
                    </button>
                    <button
                        className={`btn btn-sm ${filters.is_valid === 'false' ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => setFilters(p => ({ ...p, is_valid: 'false' }))}>
                        تحتاج مراجعة وتصحيح
                    </button>
                    <button
                        className={`btn btn-sm ${filters.is_valid === 'true' ? 'btn-success' : 'btn-secondary'}`}
                        onClick={() => setFilters(p => ({ ...p, is_valid: 'true' }))}>
                        صحيحة فقط
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-bar" style={{ flex: '1 1 200px', minWidth: 180 }}>
                        <IconSearch />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالرقم أو الاسم أو المالك..." />
                    </div>
                    <select className="form-control" style={{ width: 130 }} value={filters.stable_id} onChange={e => setFilters(p => ({ ...p, stable_id: e.target.value }))}>
                        <option value="">جميع المنقيات</option>
                        {stables.map((s: Stable) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className="form-control" style={{ width: 120 }} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                        <option value="">جميع الحالات</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <select className="form-control" style={{ width: 110 }} value={filters.gender} onChange={e => setFilters(p => ({ ...p, gender: e.target.value }))}>
                        <option value="">الجنس</option>
                        <option value="ذكر">ذكر</option>
                        <option value="أنثى">أنثى</option>
                    </select>
                    <select className="form-control" style={{ width: 110 }} value={filters.is_valid} onChange={e => setFilters(p => ({ ...p, is_valid: e.target.value }))}>
                        <option value="">الكل</option>
                        <option value="true">صحيح فقط</option>
                        <option value="false">به خطأ</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                    {isLoading ? (
                        <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
                    ) : camels.length === 0 ? (
                        <div className="empty-state" style={{ padding: '3rem' }}>
                            <div className="empty-state-icon">🐪</div>
                            <h3>لا توجد نياق</h3>
                            <p>أضف ناقتك الأولى</p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={camels.length > 0 && selectedIds.size === camels.length}
                                            onChange={toggleSelectAll}
                                            title="تحديد الكل"
                                        />
                                    </th>
                                    <th>الرقم</th>
                                    <th>الاسم</th>
                                    <th>المنقية</th>
                                    <th>الجنس</th>
                                    <th>النقاط</th>
                                    <th>التباعد</th>
                                    <th style={{ textAlign: 'center' }}>الرقبة</th>
                                    <th style={{ textAlign: 'center' }}>الشفاه</th>
                                    <th style={{ textAlign: 'center' }}>الأنف</th>
                                    <th style={{ textAlign: 'center' }}>الرأس</th>
                                    <th style={{ textAlign: 'center' }}>الرموش</th>
                                    <th style={{ textAlign: 'center' }}>الأذن</th>
                                    <th style={{ textAlign: 'center' }}>السنام</th>
                                    <th>الحالة</th>
                                    <th>الصحة</th>
                                    <th style={{ textAlign: 'center' }}>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {camels.map((c: Camel) => {
                                    const isSelected = selectedIds.has(c.id)
                                    const hasZeroOrMissing = ATTRIBUTES.some(a => {
                                        const val = c[a as keyof Camel]
                                        return val === undefined || val === null || (val as number) <= 0
                                    })
                                    return (
                                        <tr key={c.id}
                                            style={isSelected ? { background: 'var(--primary-light)' } : undefined}
                                            className={`camel-row ${!hasZeroOrMissing && c.is_valid ? 'valid' : c.needs_review || hasZeroOrMissing ? 'warning' : 'invalid'}`}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelect(c.id)}
                                                />
                                            </td>
                                            <td><strong style={{ color: 'var(--primary)' }}>{c.number}</strong></td>
                                            <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || '—'}</td>
                                            <td><span className="badge badge-gray">{c.stable_name || '—'}</span></td>
                                            <td>{c.gender || '—'}</td>
                                            <td><strong style={{ color: !hasZeroOrMissing && c.points_valid ? 'var(--success)' : 'var(--danger)' }}>{c.points?.toLocaleString('ar') ?? '—'}</strong></td>
                                            <td><span className={`badge badge-${(c.spacing ?? 99) === 0 ? 'green' : (c.spacing ?? 99) <= 3 ? 'yellow' : 'red'}`}>{c.spacing ?? '—'}</span></td>
                                            {ATTRIBUTES.map(a => {
                                                const val = c[a as keyof Camel] as number | undefined
                                                const isBad = val === undefined || val === null || val <= 0
                                                return (
                                                    <td key={a} style={{
                                                        textAlign: 'center',
                                                        fontSize: '0.85rem',
                                                        color: isBad ? 'var(--danger)' : undefined,
                                                        fontWeight: isBad ? 'bold' : 'normal'
                                                    }}>
                                                        {isBad ? (
                                                            <span className="badge badge-red" style={{ fontSize: '0.75rem', padding: '1px 5px' }} title="درجة مفقودة أو غير صحيحة">
                                                                {val ?? 0}
                                                            </span>
                                                        ) : (
                                                            val
                                                        )}
                                                    </td>
                                                )
                                            })}
                                            <td>{STATUS_LABELS[c.status] || c.status}</td>
                                            <td style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'edit', camel: c })} title="انقر لتعديل وتصحيح الناقة">
                                                <CamelStatusBadge camel={c} />
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                                    <button className="btn btn-ghost btn-icon btn-sm" title="اختبر الناقة" onClick={() => setModal({ type: 'test', camel: c })}>
                                                        <IconFlask />
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon btn-sm" title="سجل التعديلات" onClick={() => setModal({ type: 'audit', camel: c })}>
                                                        <IconHistory />
                                                    </button>
                                                    <button className="btn btn-ghost btn-icon btn-sm" title="تعديل وتصحيح" onClick={() => setModal({ type: 'edit', camel: c })}>
                                                        <IconEdit />
                                                    </button>
                                                    <button className="btn btn-danger btn-icon btn-sm" title="حذف"
                                                        onClick={() => window.confirm(`حذف ناقة ${c.number}؟`) && deleteMut.mutate(c.id)}>
                                                        <IconTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modals */}
            {modal.type === 'add' && <CamelModal onClose={() => setModal({ type: null })} initialData={modal.initialData} />}
            {modal.type === 'edit' && modal.camel && (
                <CamelModal key={modal.camel.id} camel={modal.camel} onClose={() => setModal({ type: null })} />
            )}
            {modal.type === 'ocr' && (
                <OCRModal onClose={() => setModal({ type: null })}
                    onData={(data) => setModal({ type: 'add', initialData: data })} />
            )}
            {modal.type === 'audit' && modal.camel && <AuditModal camel={modal.camel} onClose={() => setModal({ type: null })} />}
            {modal.type === 'test' && modal.camel && <TestCamelModal camel={modal.camel} onClose={() => setModal({ type: null })} />}
            {showBulkModal && (
                <BulkAssignModal
                    camelIds={Array.from(selectedIds)}
                    stables={stables}
                    onClose={() => setShowBulkModal(false)}
                    onSuccess={() => setSelectedIds(new Set())}
                />
            )}
            {showSelectedModal && (
                <SelectedCamelsModal
                    camelIds={Array.from(selectedIds)}
                    camels={camels}
                    onClose={() => setShowSelectedModal(false)}
                />
            )}
        </div>
    )
}

function SelectedCamelsModal({ camelIds, camels, onClose }: { camelIds: number[]; camels: Camel[]; onClose: () => void }) {
    const selected = camels.filter(c => camelIds.includes(c.id))
    const attrs = [
        { key: 'head', label: 'الرأس', isHead: true },
        { key: 'neck', label: 'الرقبة' },
        { key: 'lips', label: 'الشفاه' },
        { key: 'nose', label: 'الأنف' },
        { key: 'eyelashes', label: 'الرموش' },
        { key: 'ear', label: 'الأذن' },
        { key: 'hump', label: 'السنام' },
    ]
    const sumPoints = selected.reduce((s, c) => s + (c.points || 0), 0)

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: 980, width: '95vw' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>🐪</span>
                        <h3>صفات النياق المختارة ({selected.length})</h3>
                    </div>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><IconX /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
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
                                {selected.map((c, idx) => (
                                    <tr key={c.id}>
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
                                                {c[a.key as keyof Camel] ?? '—'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ background: 'var(--surface-hover)', fontWeight: 800, borderTop: '2px solid var(--border)' }}>
                                    <td colSpan={3} style={{ textAlign: 'center', fontWeight: 800 }}>المجموع / المتوسط ({selected.length} نياق)</td>
                                    <td style={{ textAlign: 'center', color: 'var(--primary)', fontSize: '0.95rem', fontWeight: 800 }}>
                                        {sumPoints.toLocaleString('ar')}
                                    </td>
                                    <td style={{ textAlign: 'center', color: 'var(--info)', fontWeight: 700 }}>—</td>
                                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>—</td>
                                    {attrs.map(a => {
                                        const sum = selected.reduce((acc, c) => acc + (Number(c[a.key as keyof Camel]) || 0), 0)
                                        const avg = selected.length > 0 ? (sum / selected.length).toFixed(1) : '0'
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
                </div>
                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        مجموع النقاط: <strong style={{ color: 'var(--primary)' }}>{sumPoints.toLocaleString('ar')}</strong> نقطة
                    </div>
                    <button className="btn btn-secondary" onClick={onClose}>إغلاق</button>
                </div>
            </div>
        </div>
    )
}
