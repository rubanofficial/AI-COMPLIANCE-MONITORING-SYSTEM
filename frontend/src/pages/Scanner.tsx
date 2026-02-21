import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Link, Loader2, ArrowRight, Sparkles, Eye, CheckCircle, Clock, AlertCircle, Zap } from 'lucide-react';
import ComplianceScoreWidget from '../components/widgets/ComplianceScoreWidget';
import ViolationTimeline from '../components/widgets/ViolationTimeline';
import ProductDetailModal from '../components/widgets/ProductDetailModal';
import type { ProductDetail } from '../types';

import { evaluateProductStream, getProductDetails } from '../services/api';
import type { SSEProduct } from '../services/api';

// Status for each product card
type ProductStatus = 'pending' | 'deep_scraping' | 'rule_engine' | 'ai_analysis' | 'done' | 'error';

interface StreamProduct {
    index: number;
    product: SSEProduct['product'];
    status: ProductStatus;
    stepMessage?: string;
    compliance?: {
        score: number;
        rule_score: number;
        risk: string;
        violations: any[];
        passed_rules: string[];
        total_rules: number;
    };
    ai_analysis?: {
        summary: string;
        risk_level: string;
        detailed_insights: string;
        recommendations: string[];
        status: string;
    };
    time?: number;
    error?: string;
}

const statusConfig: Record<ProductStatus, { color: string; bg: string; icon: any; label: string }> = {
    pending: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: Clock, label: 'Waiting...' },
    deep_scraping: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', icon: Zap, label: 'Deep Scraping' },
    rule_engine: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: ScanLine, label: 'Checking Rules' },
    ai_analysis: { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', icon: Sparkles, label: 'AI Analysis' },
    done: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle, label: 'Complete' },
    error: { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)', icon: AlertCircle, label: 'Error' },
};

const Scanner: React.FC = () => {
    const [url, setUrl] = useState('');
    const [scanning, setScanning] = useState(false);
    const [phase, setPhase] = useState<'idle' | 'scraping' | 'evaluating' | 'complete'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [products, setProducts] = useState<StreamProduct[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [totalTime, setTotalTime] = useState<number | null>(null);
    const [phase1Time, setPhase1Time] = useState<number | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Product detail modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalError, setModalError] = useState('');
    const [modalDetail, setModalDetail] = useState<ProductDetail | null>(null);
    const [modalMeta, setModalMeta] = useState<{ name: string; platform: string; url: string } | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => { cleanupRef.current?.(); };
    }, []);

    const handleViewProductDetails = async (productUrl: string, platform: string, name: string) => {
        if (!productUrl) {
            alert('No product URL available for this item.');
            return;
        }
        setModalMeta({ name, platform, url: productUrl });
        setModalDetail(null);
        setModalError('');
        setModalLoading(true);
        setModalOpen(true);
        try {
            const data = await getProductDetails(productUrl, platform);
            if (data.detail) {
                setModalDetail(data.detail as ProductDetail);
            } else {
                setModalError(data.error || 'No detail data returned');
            }
        } catch (err: any) {
            setModalError(err.message || 'Failed to fetch product details');
        } finally {
            setModalLoading(false);
        }
    };

    const handleEvaluate = () => {
        if (!url.trim()) { setError('Please enter a product URL or name'); return; }
        // Cleanup previous stream
        cleanupRef.current?.();

        setError('');
        setScanning(true);
        setPhase('scraping');
        setStatusMessage('Initializing...');
        setProducts([]);
        setSelectedIndex(null);
        setTotalTime(null);
        setPhase1Time(null);

        const cleanup = evaluateProductStream(url, {
            onStatus: (message, p) => {
                setStatusMessage(message);
                if (p === 'scraping') setPhase('scraping');
            },
            onProductsFound: (foundProducts, p1Time) => {
                setPhase('evaluating');
                setPhase1Time(p1Time);
                setStatusMessage(`Found ${foundProducts.length} products in ${p1Time}s. Starting deep analysis...`);
                const mapped: StreamProduct[] = foundProducts.map(p => ({
                    index: p.index,
                    product: p.product,
                    status: 'pending' as ProductStatus,
                }));
                setProducts(mapped);
                // Auto-select first
                if (mapped.length > 0) setSelectedIndex(0);
            },
            onProductEvaluating: (index, _name, step) => {
                setProducts(prev => prev.map(p =>
                    p.index === index ? { ...p, status: step as ProductStatus, stepMessage: `Starting ${step}...` } : p
                ));
            },
            onProductStep: (index, step, message) => {
                setProducts(prev => prev.map(p =>
                    p.index === index ? { ...p, status: step as ProductStatus, stepMessage: message } : p
                ));
            },
            onProductEvaluated: (data) => {
                setProducts(prev => prev.map(p =>
                    p.index === data.index ? {
                        ...p,
                        status: 'done' as ProductStatus,
                        stepMessage: undefined,
                        product: { ...p.product, ...data.product },
                        compliance: data.compliance,
                        ai_analysis: data.ai_analysis,
                        time: data.time,
                    } : p
                ));
            },
            onProductError: (index, _name, err) => {
                setProducts(prev => prev.map(p =>
                    p.index === index ? { ...p, status: 'error' as ProductStatus, error: err } : p
                ));
            },
            onComplete: (total, time) => {
                setPhase('complete');
                setScanning(false);
                setTotalTime(time);
                setStatusMessage(`All ${total} products analyzed in ${time}s`);
            },
            onError: (message) => {
                setError(message);
                setScanning(false);
                setPhase('idle');
            },
        });
        cleanupRef.current = cleanup;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleEvaluate();
    };

    const selectedProduct = selectedIndex !== null ? products[selectedIndex] : null;

    const doneCount = products.filter(p => p.status === 'done').length;
    const errorCount = products.filter(p => p.status === 'error').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                    Product Scanner
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Enter a product name to scrape listings, then deep-analyze each for FSSAI compliance.
                </div>
            </motion.div>

            {/* Input Card */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                    background: '#ffffff', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '28px 32px',
                }}
            >
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                width: '100%', background: 'rgba(241,245,249,0.9)',
                                border: `1px solid ${error ? 'rgba(244,63,94,0.5)' : 'rgba(203,213,225,0.8)'}`,
                                borderRadius: '10px', padding: '13px 14px 13px 42px',
                                fontSize: '14px', color: '#0f172a', outline: 'none', fontFamily: 'monospace',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(16,185,129,0.5)')}
                            onBlur={e => (e.target.style.borderColor = error ? 'rgba(244,63,94,0.5)' : 'rgba(203,213,225,0.8)')}
                        />
                    </div>
                    <button
                        onClick={handleEvaluate}
                        disabled={scanning}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '13px 24px', borderRadius: '10px', border: 'none', cursor: scanning ? 'not-allowed' : 'pointer',
                            background: scanning ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg, #10b981, #059669)',
                            color: 'white', fontSize: '14px', fontWeight: 700,
                            boxShadow: scanning ? 'none' : '0 0 20px rgba(16,185,129,0.25)',
                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                        }}
                    >
                        {scanning ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                        {scanning ? 'Scanning…' : 'Evaluate'}
                        {!scanning && <ArrowRight size={14} />}
                    </button>
                </div>
                {error && <div style={{ fontSize: '13px', color: '#f43f5e', marginTop: '8px' }}>{error}</div>}

                {/* Sample queries */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#475569' }}>Try:</span>
                    {['amul milk', 'maggi noodles', 'lays chips', 'parle-g biscuits'].map(sample => (
                        <button
                            key={sample}
                            onClick={() => { setUrl(sample); setError(''); }}
                            style={{
                                fontSize: '12px', color: '#64748b', background: 'rgba(226,232,240,0.6)',
                                border: '1px solid rgba(203,213,225,0.6)', borderRadius: '5px', padding: '3px 10px',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                        >
                            {sample}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* Live Status Bar */}
            <AnimatePresence>
                {(scanning || phase === 'complete') && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                            background: phase === 'complete' ? 'rgba(16,185,129,0.06)' : 'rgba(59,130,246,0.06)',
                            border: `1px solid ${phase === 'complete' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)'}`,
                            borderRadius: '10px', padding: '12px 20px',
                            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                        }}
                    >
                        {scanning && <Loader2 size={14} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />}
                        {phase === 'complete' && <CheckCircle size={14} color="#10b981" />}
                        <span style={{ fontSize: '13px', color: '#475569', flex: 1 }}>{statusMessage}</span>
                        {products.length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                                <span style={{ color: '#10b981' }}>{doneCount} done</span>
                                {errorCount > 0 && <span style={{ color: '#f43f5e' }}>{errorCount} failed</span>}
                                <span style={{ color: '#94a3b8' }}>{products.length - doneCount - errorCount} remaining</span>
                                {phase1Time && <span style={{ color: '#64748b' }}>Phase 1: {phase1Time}s</span>}
                                {totalTime && <span style={{ color: '#64748b' }}>Total: {totalTime}s</span>}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Phase 1 Loading — searching */}
            <AnimatePresence>
                {scanning && products.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                            padding: '48px 20px',
                            background: '#ffffff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px',
                        }}
                    >
                        <Loader2 size={32} color="#10b981" style={{ animation: 'spin 1.2s linear infinite' }} />
                        <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>Searching platforms...</div>
                        <div style={{ fontSize: '13px', color: '#64748b' }}>Scraping Blinkit & Zepto for product listings</div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Product Cards Grid */}
            <AnimatePresence>
                {products.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                    >
                        <div style={{
                            background: 'rgba(16,185,129,0.03)',
                            border: '1px solid rgba(16,185,129,0.15)',
                            borderRadius: '10px', padding: '14px 20px',
                        }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>
                                {products.length} Product{products.length > 1 ? 's' : ''} Found
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                {products.map((item, index) => {
                                    const isSelected = index === selectedIndex;
                                    const cfg = statusConfig[item.status];
                                    const StatusIcon = cfg.icon;
                                    const scoreColor = item.compliance
                                        ? (item.compliance.score >= 80 ? '#10b981' : item.compliance.score >= 50 ? '#f59e0b' : '#f43f5e')
                                        : cfg.color;

                                    return (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => setSelectedIndex(index)}
                                            style={{
                                                background: isSelected ? 'rgba(16,185,129,0.08)' : '#ffffff',
                                                border: isSelected ? '2px solid rgba(16,185,129,0.5)' : '1px solid rgba(226,232,240,0.8)',
                                                borderRadius: '8px', padding: '12px 14px',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                position: 'relative', overflow: 'hidden',
                                            }}
                                        >
                                            {/* Processing indicator bar */}
                                            {item.status !== 'done' && item.status !== 'error' && item.status !== 'pending' && (
                                                <div style={{
                                                    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                                                    background: `linear-gradient(90deg, ${cfg.color}, transparent)`,
                                                    animation: 'shimmer 1.5s ease-in-out infinite',
                                                }} />
                                            )}
                                            {/* Image + Name */}
                                            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                                                {item.product.product_image && (
                                                    <img
                                                        src={item.product.product_image}
                                                        alt={item.product.name}
                                                        style={{
                                                            width: '44px', height: '44px', objectFit: 'contain',
                                                            borderRadius: '6px', background: 'rgba(241,245,249,0.8)',
                                                            border: '1px solid rgba(226,232,240,0.8)', flexShrink: 0, padding: '2px',
                                                        }}
                                                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: '13px', fontWeight: 600, color: '#0f172a',
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '3px'
                                                    }}>
                                                        {item.product.name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                                        {item.product.store_name} · {item.product.platform}
                                                    </div>
                                                </div>
                                                {/* Score or Status */}
                                                {item.status === 'done' && item.compliance ? (
                                                    <div style={{ fontSize: '18px', fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
                                                        {item.compliance.score}
                                                    </div>
                                                ) : (
                                                    <StatusIcon size={18} color={cfg.color} style={
                                                        item.status !== 'pending' && item.status !== 'done' && item.status !== 'error'
                                                            ? { animation: 'spin 2s linear infinite' }
                                                            : {}
                                                    } />
                                                )}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#475569' }}>
                                                ₹{item.product.price} · {item.product.weight}
                                            </div>
                                            {/* Status badge / compliance badges */}
                                            <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {item.status === 'done' && item.compliance ? (
                                                    <>
                                                        <span style={{ padding: '2px 6px', background: 'rgba(16,185,129,0.15)', borderRadius: '4px', fontSize: '10px', color: '#10b981' }}>
                                                            {item.compliance.passed_rules.length} passed
                                                        </span>
                                                        <span style={{ padding: '2px 6px', background: 'rgba(244,63,94,0.15)', borderRadius: '4px', fontSize: '10px', color: '#f43f5e' }}>
                                                            {item.compliance.violations.length} issues
                                                        </span>
                                                        <span style={{ padding: '2px 6px', background: scoreColor === '#10b981' ? 'rgba(16,185,129,0.12)' : scoreColor === '#f59e0b' ? 'rgba(245,158,11,0.12)' : 'rgba(244,63,94,0.12)', borderRadius: '4px', fontSize: '10px', color: scoreColor, fontWeight: 600 }}>
                                                            {item.compliance.risk} Risk
                                                        </span>
                                                        {item.time && (
                                                            <span style={{ padding: '2px 6px', background: 'rgba(148,163,184,0.1)', borderRadius: '4px', fontSize: '10px', color: '#94a3b8' }}>
                                                                {item.time}s
                                                            </span>
                                                        )}
                                                        {item.product.product_url && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleViewProductDetails(item.product.product_url, item.product.platform, item.product.name); }}
                                                                style={{
                                                                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px',
                                                                    fontWeight: 600, color: '#38bdf8', background: 'rgba(56,189,248,0.08)',
                                                                    border: '1px solid rgba(56,189,248,0.2)', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer',
                                                                }}
                                                            >
                                                                <Eye size={10} /> Details
                                                            </button>
                                                        )}
                                                    </>
                                                ) : item.status === 'error' ? (
                                                    <span style={{ padding: '2px 8px', background: cfg.bg, borderRadius: '4px', fontSize: '10px', color: cfg.color }}>
                                                        Failed: {item.error?.slice(0, 50)}
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        padding: '2px 8px', background: cfg.bg, borderRadius: '4px',
                                                        fontSize: '10px', color: cfg.color, fontWeight: 500,
                                                    }}>
                                                        {item.stepMessage || cfg.label}
                                                    </span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Selected Product Details */}
                        {selectedProduct && selectedProduct.status === 'done' && selectedProduct.compliance && (
                            <motion.div
                                key={selectedIndex}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
                            >
                                {/* Product Info Banner */}
                                <div style={{
                                    background: '#ffffff', backdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(226,232,240,0.8)', borderRadius: '10px', padding: '14px 20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {selectedProduct.product.product_image && (
                                            <img
                                                src={selectedProduct.product.product_image}
                                                alt={selectedProduct.product.name}
                                                style={{
                                                    width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px',
                                                    background: 'rgba(241,245,249,0.8)', border: '1px solid rgba(226,232,240,0.8)', padding: '3px',
                                                }}
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        )}
                                        <div>
                                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                                {selectedProduct.product.name}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                ₹{selectedProduct.product.price} · MRP ₹{selectedProduct.product.mrp} · {selectedProduct.product.weight} · FSSAI: {selectedProduct.product.fssai_number || 'N/A'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {selectedProduct.time && (
                                            <div style={{ fontSize: '12px', color: '#475569' }}>
                                                Analyzed in {selectedProduct.time}s
                                            </div>
                                        )}
                                        {selectedProduct.product.product_url && (
                                            <button
                                                onClick={() => handleViewProductDetails(
                                                    selectedProduct.product.product_url,
                                                    selectedProduct.product.platform,
                                                    selectedProduct.product.name
                                                )}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    padding: '8px 16px', borderRadius: '8px',
                                                    background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(56,189,248,0.05))',
                                                    border: '1px solid rgba(56,189,248,0.3)',
                                                    color: '#38bdf8', fontSize: '13px', fontWeight: 600,
                                                    cursor: 'pointer', transition: 'all 0.2s',
                                                }}
                                            >
                                                <Eye size={14} /> View Full Details
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Score + Violations */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                    gap: '20px', alignItems: 'start'
                                }}>
                                    <div style={{ position: 'sticky', top: '20px' }}>
                                        <ComplianceScoreWidget
                                            score={selectedProduct.compliance.score}
                                            totalRules={selectedProduct.compliance.total_rules}
                                            passedRules={selectedProduct.compliance.passed_rules.length}
                                        />
                                    </div>
                                    <div style={{
                                        maxHeight: '600px', overflowY: 'auto', paddingRight: '4px',
                                        scrollbarWidth: 'thin', scrollbarColor: 'rgba(203,213,225,0.8) transparent'
                                    }}>
                                        <ViolationTimeline violations={selectedProduct.compliance.violations} />
                                    </div>
                                </div>

                                {/* AI Analysis */}
                                {selectedProduct.ai_analysis && (
                                    <div style={{
                                        background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(71,85,105,0.3)',
                                        borderRadius: '12px', padding: '20px 24px',
                                    }}>
                                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Sparkles size={16} color="#a78bfa" /> AI Insights
                                            <span style={{
                                                marginLeft: 'auto', fontSize: '11px', padding: '2px 8px',
                                                background: selectedProduct.ai_analysis.risk_level === 'LOW' ? 'rgba(16,185,129,0.15)' :
                                                    selectedProduct.ai_analysis.risk_level === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                                                color: selectedProduct.ai_analysis.risk_level === 'LOW' ? '#10b981' :
                                                    selectedProduct.ai_analysis.risk_level === 'MEDIUM' ? '#f59e0b' : '#f43f5e',
                                                borderRadius: '4px', fontWeight: 600,
                                            }}>
                                                {selectedProduct.ai_analysis.risk_level} RISK
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, marginBottom: '6px' }}>
                                            {selectedProduct.ai_analysis.summary}
                                        </p>
                                        {selectedProduct.ai_analysis.detailed_insights && (
                                            <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, marginBottom: '16px' }}>
                                                {selectedProduct.ai_analysis.detailed_insights}
                                            </p>
                                        )}
                                        {selectedProduct.ai_analysis.recommendations && selectedProduct.ai_analysis.recommendations.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    Recommendations
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {selectedProduct.ai_analysis.recommendations.map((rec: string, i: number) => (
                                                        <motion.div
                                                            key={i}
                                                            initial={{ opacity: 0, x: -10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: i * 0.08 }}
                                                            style={{
                                                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                                                padding: '10px 14px', borderRadius: '8px',
                                                                background: 'rgba(241,245,249,0.8)', border: '1px solid rgba(226,232,240,0.6)',
                                                            }}
                                                        >
                                                            <div style={{
                                                                width: '20px', height: '20px', borderRadius: '50%',
                                                                background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.25)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0, fontSize: '11px', fontWeight: 700, color: '#a78bfa'
                                                            }}>{i + 1}</div>
                                                            <span style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{rec}</span>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* Selected product is still processing */}
                        {selectedProduct && selectedProduct.status !== 'done' && selectedProduct.status !== 'error' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                                    padding: '40px 20px',
                                    background: '#ffffff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px',
                                }}
                            >
                                <Loader2 size={28} color={statusConfig[selectedProduct.status].color} style={{ animation: 'spin 1.2s linear infinite' }} />
                                <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                    {statusConfig[selectedProduct.status].label}: {selectedProduct.product.name}
                                </div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>
                                    {selectedProduct.stepMessage || 'Processing...'}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes shimmer { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
            `}</style>

            {/* Product Detail Modal */}
            <ProductDetailModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                loading={modalLoading}
                error={modalError}
                detail={modalDetail}
                productName={modalMeta?.name}
                platform={modalMeta?.platform}
                productUrl={modalMeta?.url}
            />
        </div>
    );
};

export default Scanner;
