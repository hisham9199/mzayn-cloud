import { useState } from 'react'
import { useQuery } from 'react-query'
import toast from 'react-hot-toast'
import { excelApi, stableApi } from '../api/client'
import { Stable } from '../types'

export default function ExcelIO() {
    const { data: stables = [] } = useQuery('stables', () => stableApi.list().then(r => r.data))
    const [exportStableId, setExportStableId] = useState('')
    const [exportFormat, setExportFormat] = useState<'rows' | 'columns'>('rows')
    const [importStableId, setImportStableId] = useState('')
    const [importFile, setImportFile] = useState<File | null>(null)
    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<any>(null)

    const downloadExport = async () => {
        try {
            const res = await excelApi.export({ stable_id: exportStableId || undefined, format: exportFormat })
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'camels_export.xlsx'
            a.click()
            URL.revokeObjectURL(url)
            toast.success('تم تصدير الملف')
        } catch {
            toast.error('فشل التصدير')
        }
    }

    const doImport = async () => {
        if (!importFile) return
        setImporting(true)
        try {
            const res = await excelApi.import(importFile, importStableId ? parseInt(importStableId) : undefined)
            setImportResult(res.data)
            toast.success(`تم الاستيراد: ${res.data.imported} ناقة`)
        } catch (e: any) {
            toast.error(e.response?.data?.detail || 'فشل الاستيراد')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div className="animate-fadeIn">
            <div className="page-top">
                <div>
                    <h1>استيراد وتصدير Excel</h1>
                    <p className="page-subtitle">تبادل بيانات النياق مع ملفات Excel</p>
                </div>
            </div>

            <div className="grid-2" style={{ gap: '1.25rem', marginBottom: '1.25rem' }}>
                {/* Export */}
                <div className="card">
                    <div className="section-title">
                        <div className="section-title-icon">📤</div>
                        <h2>تصدير Excel</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">المنقية (اختياري - فارغ = الكل)</label>
                            <select className="form-control" value={exportStableId} onChange={e => setExportStableId(e.target.value)}>
                                <option value="">جميع المنقيات</option>
                                {stables.map((s: Stable) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">شكل التصدير</label>
                            <select className="form-control" value={exportFormat} onChange={e => setExportFormat(e.target.value as any)}>
                                <option value="rows">صفوف (كل ناقة في صف)</option>
                                <option value="columns">أعمدة (النياق كأعمدة، الصفات كصفوف)</option>
                            </select>
                        </div>
                        <div style={{ padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {exportFormat === 'columns'
                                ? '📊 الصفات كصفوف — النياق كأعمدة'
                                : '📄 كل ناقة في صف مستقل مع جميع الحقول'}
                        </div>
                        <button className="btn btn-primary" onClick={downloadExport}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            تصدير كـ Excel
                        </button>
                    </div>
                </div>

                {/* Import */}
                <div className="card">
                    <div className="section-title">
                        <div className="section-title-icon">📥</div>
                        <h2>استيراد من Excel</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">المنقية (اختياري)</label>
                            <select className="form-control" value={importStableId} onChange={e => setImportStableId(e.target.value)}>
                                <option value="">بدون منقية</option>
                                {stables.map((s: Stable) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">ملف Excel</label>
                            <div className={`dropzone ${importFile ? 'active' : ''}`} style={{ padding: '1.25rem' }}
                                onClick={() => document.getElementById('excel-import-input')?.click()}>
                                <input id="excel-import-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                                    onChange={e => e.target.files?.[0] && setImportFile(e.target.files[0])} />
                                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📁</div>
                                <p style={{ fontSize: '0.875rem', color: importFile ? 'var(--success)' : 'var(--text-secondary)', fontWeight: importFile ? 600 : 400 }}>
                                    {importFile ? importFile.name : 'اضغط لاختيار ملف xlsx'}
                                </p>
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={doImport} disabled={!importFile || importing}>
                            {importing ? (
                                <><div className="spinner" style={{width:16,height:16}} /> جاري الاستيراد...</>
                            ) : (
                                <>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                        <polyline points="17 8 12 3 7 8"/>
                                        <line x1="12" y1="3" x2="12" y2="15"/>
                                    </svg>
                                    استيراد
                                </>
                            )}
                        </button>

                        {importResult && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div className="validation-alert success">
                                    ✅ تم استيراد {importResult.imported} ناقة من {importResult.total_rows} صف
                                </div>
                                {importResult.errors?.length > 0 && (
                                    <div className="validation-alert error" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <span>❌ أخطاء ({importResult.errors.length}):</span>
                                        <ul style={{ marginTop: '0.35rem', paddingRight: '1.25rem', fontSize: '0.8rem' }}>
                                            {importResult.errors.slice(0, 5).map((e: string, i: number) => <li key={i}>{e}</li>)}
                                            {importResult.errors.length > 5 && <li>...و{importResult.errors.length - 5} أخطاء أخرى</li>}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Format guide */}
            <div className="card">
                <div className="section-title">
                    <div className="section-title-icon">ℹ</div>
                    <h2>دليل تنسيق الملف</h2>
                </div>
                <div className="grid-2" style={{ gap: '1rem' }}>
                    <div>
                        <h4 style={{ marginBottom: '0.6rem', color: 'var(--text-secondary)' }}>📄 شكل الصفوف (الأعمدة)</h4>
                        <div style={{
                            background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                            padding: '0.85rem', fontSize: '0.8rem', fontFamily: 'monospace',
                            overflowX: 'auto', border: '1px solid var(--border)',
                        }}>
                            <div style={{ color: 'var(--primary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                                رقم الناقة | الاسم | النقاط | الأنف | الشفاه | الرأس | الرقبة | السنام | الرموش | الأذن
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>61 | صاد 61 | 1994 | 285 | 284 | 285 | 284 | 284 | 286 | 286</div>
                        </div>
                    </div>
                    <div>
                        <h4 style={{ marginBottom: '0.6rem', color: 'var(--text-secondary)' }}>📊 شكل الأعمدة (الصفة)</h4>
                        <div style={{
                            background: 'var(--bg)', borderRadius: 'var(--radius-sm)',
                            padding: '0.85rem', fontSize: '0.8rem', fontFamily: 'monospace',
                            overflowX: 'auto', border: '1px solid var(--border)',
                        }}>
                            <div style={{ color: 'var(--primary)', marginBottom: '0.25rem', fontWeight: 600 }}>الصفة | ناقة 61 | ناقة 62 | ...</div>
                            <div style={{ color: 'var(--text-muted)' }}>
                                النقاط | 1994 | 2000<br />
                                الأنف | 285 | 290<br />
                                الشفاه | 284 | 285
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
