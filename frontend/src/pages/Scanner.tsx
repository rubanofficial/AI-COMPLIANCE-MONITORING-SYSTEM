import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Link, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import ComplianceScoreWidget from '../components/widgets/ComplianceScoreWidget';
import ViolationTimeline from '../components/widgets/ViolationTimeline';
import DualViewScraperData from '../components/widgets/DualViewScraperData';
import SkeletonCard from '../components/ui/SkeletonCard';
import type { EvaluateResponse } from '../types';

import { evaluateProduct } from '../services/api';

const Scanner: React.FC = () => {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [error, setError] = useState('');

    const handleEvaluate = async () => {
        if (!url.trim()) { setError('Please enter a product URL or name'); return; }
        setError('');
        setLoading(true);
        setResults([]);
        setSelectedIndex(0);

        try {
            const data = await evaluateProduct(url);
            if (data.results && data.results.length > 0) {
                // Map all results, not just the first one
                const mappedResults = data.results.map((result: any) => {
                    const product = {
                        name: result.product.product_name || result.product.name,
                        price: Number(result.product.price),
                        mrp: Number(result.product.mrp),
                        discount: Number(result.product.discount || 0),
                        weight: result.product.weight || 'N/A',
                        ingredients: result.product.ingredients || 'N/A',
                        fssai_number: result.product.fssai_number || 'N/A',
                        manufacturer_name: result.product.manufacturer_name || 'N/A',
                        manufacturer_address: result.product.manufacturer_address || 'N/A',
                        expiry_date: result.product.expiry_date || 'N/A',
                        platform: result.product.platform || 'unknown',
                        store_name: result.product.store_name || 'Unknown Store'
                    };

                    return {
                        product: product,
                        compliance: {
                            rule_score: result.compliance.rule_score,
                            violations: result.compliance.violations,
                            passed_rules: result.compliance.passed_rules,
                            total_rules: result.compliance.total_rules
                        },
                        ai_analysis: {
                            summary: "Product evaluation complete.",
                            risk_level: (result.compliance.risk || 'MEDIUM').toUpperCase() as any,
                            detailed_insights: result.ai_meta.status === "Success"
                                ? `Comprehensive analysis completed. ${result.compliance.violations.length} issues identified.`
                                : "AI analysis skipped or limited by data availability.",
                            recommendations: [
                                "Ensure FSSAI number is accurately displayed on the packaging.",
                                "Review ingredient list for potential allergens not highlighted.",
                                "Verify manufacturer details match the registered FSSAI license."
                            ]
                        },
                        evaluated_at: new Date().toISOString(),
                        source_a_label: "E-Commerce Data",
                        source_b_label: "OCR Analysis",
                        source_a_data: result.product,
                        source_b_data: result.ocr_summary
                    };
                });

                setResults(mappedResults);
            } else {
                setError('No products found or evaluation failed');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during evaluation');
        } finally {
            setLoading(false);
        }
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
                    <Link size={14} /> Product URL or Name
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                        <ScanLine size={16} color="#475569" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Product name (e.g., 'amul milk') or URL"
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
                {results.length > 0 && !loading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        {/* Products Summary */}
                        <div style={{
                            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)',
                            borderRadius: '10px', padding: '14px 20px',
                        }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px' }}>
                                Found {results.length} Product{results.length > 1 ? 's' : ''}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                {results.map((result, index) => {
                                    const isSelected = index === selectedIndex;
                                    const scoreColor = result.compliance.rule_score >= 80 ? '#10b981' :
                                        result.compliance.rule_score >= 50 ? '#f59e0b' : '#f43f5e';
                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.1 }}
                                            onClick={() => setSelectedIndex(index)}
                                            style={{
                                                background: isSelected ? 'rgba(16,185,129,0.1)' : 'rgba(15,23,42,0.5)',
                                                border: isSelected ? '2px solid rgba(16,185,129,0.5)' : '1px solid rgba(51,65,85,0.3)',
                                                borderRadius: '8px',
                                                padding: '12px 14px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                            whileHover={{ scale: 1.02, borderColor: 'rgba(16,185,129,0.4)' } as any}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        color: '#e2e8f0',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        marginBottom: '4px'
                                                    }}>
                                                        {result.product.name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                        {result.product.store_name} · {result.product.platform}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: '16px',
                                                    fontWeight: 700,
                                                    color: scoreColor,
                                                    marginLeft: '8px'
                                                }}>
                                                    {result.compliance.rule_score}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#475569' }}>
                                                ₹{result.product.price} · {result.product.weight}
                                            </div>
                                            <div style={{
                                                marginTop: '8px',
                                                display: 'flex',
                                                gap: '4px',
                                                fontSize: '10px',
                                                color: '#64748b'
                                            }}>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    background: 'rgba(16,185,129,0.15)',
                                                    borderRadius: '4px',
                                                    color: '#10b981'
                                                }}>
                                                    {result.compliance.passed_rules.length} passed
                                                </span>
                                                <span style={{
                                                    padding: '2px 6px',
                                                    background: 'rgba(244,63,94,0.15)',
                                                    borderRadius: '4px',
                                                    color: '#f43f5e'
                                                }}>
                                                    {result.compliance.violations.length} issues
                                                </span>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected Product Details */}
                        {results[selectedIndex] && (
                            <motion.div
                                key={selectedIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                            >
                                {/* Product Info Banner */}
                                <div style={{
                                    background: 'rgba(30,41,59,0.6)',
                                    backdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(71,85,105,0.3)',
                                    borderRadius: '10px',
                                    padding: '14px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0' }}>
                                            {results[selectedIndex].product.name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                            ₹{results[selectedIndex].product.price} · MRP ₹{results[selectedIndex].product.mrp} · {results[selectedIndex].product.weight} · FSSAI: {results[selectedIndex].product.fssai_number}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569' }}>
                                        Evaluated @ {new Date(results[selectedIndex].evaluated_at).toLocaleTimeString('en-IN')}
                                    </div>
                                </div>

                                {/* Score + Violations Wrapper */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                    gap: '20px',
                                    alignItems: 'start'
                                }}>
                                    <div style={{ position: 'sticky', top: '20px' }}>
                                        <ComplianceScoreWidget
                                            score={results[selectedIndex].compliance.rule_score}
                                            totalRules={results[selectedIndex].compliance.total_rules}
                                            passedRules={results[selectedIndex].compliance.passed_rules.length}
                                        />
                                    </div>
                                    <div style={{
                                        maxHeight: '600px',
                                        overflowY: 'auto',
                                        paddingRight: '4px',
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: 'rgba(51,65,85,0.5) transparent'
                                    }}>
                                        <ViolationTimeline violations={results[selectedIndex].compliance.violations} />
                                    </div>
                                </div>

                                {/* Analysis Grid */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) 400px',
                                    gap: '20px',
                                    flexWrap: 'wrap'
                                }}>
                                    {/* AI Analysis */}
                                    <div style={{
                                        background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
                                        border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '20px 24px',
                                    }}>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Sparkles size={16} color="#a78bfa" /> AI Insights
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, marginBottom: '16px' }}>
                                            {results[selectedIndex].ai_analysis.detailed_insights}
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommendations</div>
                                            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                                                {results[selectedIndex].ai_analysis.recommendations.map((rec, i) => (
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
                                    </div>

                                    {/* Dual View - Nested or Side by Side */}
                                    <div style={{ minWidth: 0 }}>
                                        <DualViewScraperData
                                            sourceALabel={results[selectedIndex].source_a_label}
                                            sourceBLabel={results[selectedIndex].source_b_label}
                                            sourceAData={results[selectedIndex].source_a_data}
                                            sourceBData={results[selectedIndex].source_b_data}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default Scanner;
