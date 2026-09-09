import React from 'react';
import { motion } from 'framer-motion';
import { GitCompare, AlertCircle } from 'lucide-react';

const fieldLabels = [
    { key: 'name', label: 'Product Name' },
    { key: 'price', label: 'Price (₹)' },
    { key: 'mrp', label: 'MRP (₹)' },
    { key: 'weight', label: 'Weight / Volume' },
    { key: 'fssai_number', label: 'FSSAI Number' },
    { key: 'manufacturer_name', label: 'Manufacturer' },
    { key: 'expiry_date', label: 'Expiry / Best Before' },
];

const isDifferent = (a, b) =>
    a !== undefined && b !== undefined && String(a).trim() !== String(b).trim();

const SkeletonRow = () => (
    <div style={{ display: 'flex', gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(226,232,240,0.6)' }}>
        <div style={{ width: '120px', height: '14px', borderRadius: '4px', background: 'rgba(226,232,240,0.6)', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ flex: 1, height: '14px', borderRadius: '4px', background: 'rgba(226,232,240,0.5)', animation: 'shimmer 1.5s infinite' }} />
        <div style={{ flex: 1, height: '14px', borderRadius: '4px', background: 'rgba(226,232,240,0.5)', animation: 'shimmer 1.5s infinite' }} />
    </div>
);

const DualViewScraperData = ({
    sourceALabel, sourceBLabel, sourceAData, sourceBData, loading,
}) => {
    if (loading) {
        return (
            <div style={{ background: '#ffffff', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}>
                <div style={{ width: '200px', height: '18px', borderRadius: '5px', background: 'rgba(226,232,240,0.6)', marginBottom: '20px', animation: 'shimmer 1.5s infinite' }} />
                {[1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)}
            </div>
        );
    }

    const mismatchCount = fieldLabels.filter(({ key }) => isDifferent(sourceAData[key], sourceBData[key])).length;

    return (
        <div style={{ background: '#ffffff', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GitCompare size={16} color="#94a3b8" />
                    Dual-Source Comparison
                </div>
                {mismatchCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '4px 10px' }}>
                        <AlertCircle size={12} />
                        {mismatchCount} mismatch{mismatchCount > 1 ? 'es' : ''}
                    </div>
                )}
            </div>

            {/* Column Headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '8px', marginBottom: '8px', padding: '0 0 8px', borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Field</div>
                {[sourceALabel, sourceBLabel].map((label, idx) => (
                    <div key={idx} style={{
                        fontSize: '12px', fontWeight: 700,
                        color: idx === 0 ? '#10b981' : '#a78bfa',
                        background: idx === 0 ? 'rgba(16,185,129,0.08)' : 'rgba(167,139,250,0.08)',
                        border: `1px solid ${idx === 0 ? 'rgba(16,185,129,0.2)' : 'rgba(167,139,250,0.2)'}`,
                        borderRadius: '6px', padding: '5px 10px', textAlign: 'center',
                    }}>
                        {label}
                    </div>
                ))}
            </div>

            {/* Rows */}
            {fieldLabels.map(({ key, label }, i) => {
                const aVal = sourceAData[key] !== undefined ? String(sourceAData[key]) : '—';
                const bVal = sourceBData[key] !== undefined ? String(sourceBData[key]) : '—';
                const mismatch = isDifferent(sourceAData[key], sourceBData[key]);

                return (
                    <motion.div
                        key={key}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        style={{
                            display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '8px',
                            padding: '10px 0',
                            borderBottom: i < fieldLabels.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none',
                            background: mismatch ? 'rgba(245,158,11,0.03)' : 'transparent',
                            borderRadius: '4px',
                        }}
                    >
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {mismatch && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0, boxShadow: '0 0 5px #f59e0b88' }} />}
                            {label}
                        </div>
                        {[aVal, bVal].map((val, idx) => (
                            <div key={idx} style={{
                                fontSize: '12px',
                                color: mismatch ? (idx === 0 ? '#10b981' : '#a78bfa') : '#475569',
                                fontWeight: mismatch ? 600 : 400,
                                background: mismatch ? (idx === 0 ? 'rgba(16,185,129,0.06)' : 'rgba(167,139,250,0.06)') : 'transparent',
                                border: mismatch ? `1px solid ${idx === 0 ? 'rgba(16,185,129,0.15)' : 'rgba(167,139,250,0.15)'}` : '1px solid transparent',
                                borderRadius: '5px',
                                padding: mismatch ? '3px 8px' : '3px 8px',
                                wordBreak: 'break-word',
                            }}>
                                {val}
                            </div>
                        ))}
                    </motion.div>
                );
            })}
        </div>
    );
};

export default DualViewScraperData;
