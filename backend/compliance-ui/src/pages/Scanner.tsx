import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Link, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import ComplianceScoreWidget from '../components/widgets/ComplianceScoreWidget';
import ViolationTimeline from '../components/widgets/ViolationTimeline';
import DualViewScraperData from '../components/widgets/DualViewScraperData';
import SkeletonCard from '../components/ui/SkeletonCard';
import { mockEvaluateResponse } from '../data/mockData';
import type { EvaluateResponse } from '../types';

const Scanner: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<EvaluateResponse | null>(null);
    const [error, setError] = useState('');

    const handleEvaluate = async () => {
        if (!url.trim()) { setError('Please enter a product URL'); return; }
        setError('');
        setLoading(true);
        setResult(null);
        // Simulate /evaluate API call with a 2.2s delay
        await new Promise(res => setTimeout(res, 2200));
        setResult(mockEvaluateResponse);
        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleEvaluate();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>
                    Product Scanner
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Enter a quick-commerce product URL to evaluate FSSAI & regulatory compliance.
                </div>
            </motion.div>

            {/* Input Card */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                    background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '28px 32px',
                }}
            >
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Link size={14} /> Product URL
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                        <ScanLine size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="url"
                            placeholder="https://blinkit.com/prn/amul-taaza-toned-fresh-milk..."
                            value={url}
                            onChange={e => { setUrl(e.target.value); setError(''); }}
                            onKeyDown={handleKeyDown}
                            style={{
                                width: '100%', background: 'rgba(15,23,42,0.6)',
                                border: `1px solid ${error ? 'rgba(244,63,94,0.5)' : 'rgba(51,65,85,0.4)'}`,
                                borderRadius: '10px', padding: '13px 14px 13px 42px',
                                fontSize: '14px', color: '#e2e8f0', outline: 'none', fontFamily: 'monospace',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(16,185,129,0.4)')}
                            onBlur={e => (e.target.style.borderColor = error ? 'rgba(244,63,94,0.5)' : 'rgba(51,65,85,0.4)')}
                        />
                    </div>
                    <button
                        onClick={handleEvaluate}
                        disabled={loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '13px 24px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                            background: loading ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white', fontSize: '14px', fontWeight: 700,
                            boxShadow: loading ? 'none' : '0 0 20px rgba(16,185,129,0.25)',
                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}
                    >
                        {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                        {loading ? 'Evaluating…' : 'Evaluate'}
                        {!loading && <ArrowRight size={14} />}
                    </button>
                </div>
                {error && <div style={{ fontSize: '13px', color: '#f43f5e', marginTop: '8px' }}>{error}</div>}

                {/* Sample URLs */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#475569' }}>Try:</span>
                    {[
                        'blinkit.com/amul-taaza-milk',
                        'zepto.com/maggi-noodles',
                        'blinkit.com/lays-classic',
                    ].map(sample => (
                        <button
                            key={sample}
                            onClick={() => { setUrl(`https://${sample}`); setError(''); }}
                            style={{
                                fontSize: '12px', color: '#64748b', background: 'rgba(51,65,85,0.3)',
                                border: '1px solid rgba(51,65,85,0.3)', borderRadius: '5px', padding: '3px 10px',
                                cursor: 'pointer', fontFamily: 'monospace', transition: 'all 0.2s',
                            }}
                        >
                            {sample}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Loading State */}
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                            <SkeletonCard height={340} />
                            <SkeletonCard height={340} rows={5} />
                        </div>
                        <SkeletonCard height={200} rows={2} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results */}
            <AnimatePresence>
                {result && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        {/* Product Info Banner */}
                        <div style={{
                            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '10px', padding: '14px 20px',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                        }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>{result.product.name}</div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                    ₹{result.product.price} · MRP ₹{result.product.mrp} · {result.product.weight} · FSSAI: {result.product.fssai_number}
                                </div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                                Evaluated @ {new Date(result.evaluated_at).toLocaleTimeString('en-IN')}
                            </div>
                        </div>

                        {/* Score + Violations */}
                        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
                            <ComplianceScoreWidget
                                score={result.compliance.rule_score}
                                totalRules={result.compliance.total_rules}
                                passedRules={result.compliance.passed_rules.length}
                            />
                            <ViolationTimeline violations={result.compliance.violations} />
                        </div>

                        {/* AI Analysis */}
                        <div style={{
                            background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
                            border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '20px 24px',
                        }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Sparkles size={16} color="#a78bfa" /> AI Analysis
                            </div>
                            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '16px' }}>
                                {result.ai_analysis.detailed_insights}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommendations</div>
                                {result.ai_analysis.recommendations.map((rec, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                        style={{
                                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                                            padding: '10px 14px', borderRadius: '8px',
                                            background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(51,65,85,0.2)',
                                        }}
                                    >
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>{i + 1}</div>
                                        <span style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{rec}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Dual View */}
                        <DualViewScraperData
                            sourceALabel={result.source_a_label}
                            sourceBLabel={result.source_b_label}
                            sourceAData={result.source_a_data}
                            sourceBData={result.source_b_data}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default Scanner;
