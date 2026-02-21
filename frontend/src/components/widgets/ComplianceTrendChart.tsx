import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { TrendDataPoint } from '../../types';
import { motion } from 'framer-motion';

interface ComplianceTrendChartProps {
    data: TrendDataPoint[];
    loading?: boolean;
}

const CustomTooltip: React.FC<{ active?: boolean; payload?: { value: number; dataKey: string; name: string }[]; label?: string }> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226,232,240,0.9)', borderRadius: '10px', padding: '12px 16px',
            boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
        }}>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>{label}</div>
            {payload.map((p) => (
                <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: p.dataKey === 'score' ? '#10b981' : p.dataKey === 'violations' ? '#f43f5e' : '#f59e0b',
                    }} />
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{p.name}:</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                        {p.dataKey === 'score' ? `${p.value}/100` : p.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

const ComplianceTrendChart: React.FC<ComplianceTrendChartProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div style={{ background: '#ffffff', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}>
                <div style={{ width: '200px', height: '18px', borderRadius: '5px', background: 'rgba(226,232,240,0.6)', marginBottom: '24px', animation: 'shimmer 1.5s infinite' }} />
                <div style={{ height: '220px', borderRadius: '8px', background: 'rgba(226,232,240,0.4)', animation: 'shimmer 1.5s infinite' }} />
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ background: '#ffffff', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}
            >
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <TrendingUp size={16} color="#10b981" />
                    30-Day Compliance Trend
                </div>
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>
                    No trend data yet. Scan some products to see the chart.
                </div>
            </motion.div>
        );
    }

    const avgScore = Math.round(data.reduce((a, d) => a + d.score, 0) / data.length);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: '#ffffff', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}
        >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} color="#10b981" />
                    30-Day Compliance Trend
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {/* Legend */}
                    {[
                        { color: '#10b981', label: 'Score', dash: false },
                        { color: '#f43f5e', label: 'Violations', dash: false },
                    ].map(({ color, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                            <div style={{ width: '20px', height: '2px', background: color, borderRadius: '2px' }} />
                            {label}
                        </div>
                    ))}
                    <div style={{
                        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                        borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, color: '#10b981',
                    }}>
                        Avg: {avgScore}/100
                    </div>
                </div>
            </div>

            {/* Score Chart */}
            <div style={{ marginBottom: '8px' }}>
                <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.8)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={80} stroke="rgba(16,185,129,0.25)" strokeDasharray="4 4" label={{ value: 'Target', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                        <Area
                            type="monotone" dataKey="score" name="Compliance Score"
                            stroke="#10b981" strokeWidth={2.5} fill="url(#scoreGrad)"
                            dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
                            activeDot={{ r: 5, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Violations mini chart */}
            <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Violations Per Period</div>
                <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="violGrad2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone" dataKey="violations" name="Violations"
                            stroke="#f43f5e" strokeWidth={2} fill="url(#violGrad2)"
                            dot={{ fill: '#f43f5e', strokeWidth: 0, r: 2 }}
                            activeDot={{ r: 4, fill: '#f43f5e', stroke: '#0f172a', strokeWidth: 2 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
};

export default ComplianceTrendChart;
