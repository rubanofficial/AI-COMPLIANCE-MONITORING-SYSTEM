import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Package, AlertTriangle, CheckCircle, ArrowUpRight, Clock } from 'lucide-react';
import ComplianceScoreWidget from '../components/widgets/ComplianceScoreWidget';
import ViolationTimeline from '../components/widgets/ViolationTimeline';
import DualViewScraperData from '../components/widgets/DualViewScraperData';
import ComplianceTrendChart from '../components/widgets/ComplianceTrendChart';
import StatusBadge from '../components/ui/StatusBadge';
import { mockEvaluateResponse, mockTrendData, mockRecentScans } from '../data/mockData';

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: string | number; sub: string; color: string }> =
    ({ icon: Icon, label, value, sub, color }) => (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
                background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px',
                padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>{label}</div>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '9px',
                    background: `${color}18`, border: `1px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Icon size={16} color={color} />
                </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#e2e8f0', lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
            <div style={{ fontSize: '12px', color: '#475569' }}>{sub}</div>
        </motion.div>
    );

const Dashboard: React.FC = () => {
    const { compliance, source_a_label, source_b_label, source_a_data, source_b_data } = mockEvaluateResponse;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Page Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>
                    Dashboard
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Compliance overview · Last updated{' '}
                    <span style={{ color: '#94a3b8' }}>{new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </motion.div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <StatCard icon={Activity} label="Avg Compliance Score" value="72" sub="↑ 4 pts vs last week" color="#10b981" />
                <StatCard icon={Package} label="Products Scanned" value="106" sub="This month" color="#38bdf8" />
                <StatCard icon={AlertTriangle} label="Total Violations" value="47" sub="5 critical, 12 high" color="#f43f5e" />
                <StatCard icon={CheckCircle} label="Rules Passing" value="87%" sub="9 / 14 active rules" color="#10b981" />
            </div>

            {/* Main Grid: Score + Timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
                <ComplianceScoreWidget
                    score={compliance.rule_score}
                    totalRules={compliance.total_rules}
                    passedRules={compliance.passed_rules.length}
                />
                <ViolationTimeline violations={compliance.violations} />
            </div>

            {/* Trend Chart */}
            <ComplianceTrendChart data={mockTrendData} />

            {/* Dual View + Recent Scans */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
                <DualViewScraperData
                    sourceALabel={source_a_label}
                    sourceBLabel={source_b_label}
                    sourceAData={source_a_data}
                    sourceBData={source_b_data}
                />

                {/* Recent Scans */}
                <div style={{
                    background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '20px 24px',
                }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={15} color="#94a3b8" /> Recent Scans
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {mockRecentScans.map((scan, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.07 }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 10px', borderRadius: '8px',
                                    background: 'rgba(15,23,42,0.3)',
                                    marginBottom: '4px',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s',
                                }}
                                whileHover={{ background: 'rgba(30,41,59,0.5)' } as never}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {scan.name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                                        {scan.platform} · {scan.time}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    <span style={{
                                        fontSize: '13px', fontWeight: 700,
                                        color: scan.score >= 80 ? '#10b981' : scan.score >= 50 ? '#f59e0b' : '#f43f5e',
                                    }}>
                                        {scan.score}
                                    </span>
                                    <StatusBadge variant={scan.risk === 'LOW' ? 'PASSED' : scan.risk === 'HIGH' ? 'CRITICAL' : 'WARNING'} label={scan.risk} size="sm" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <button style={{
                        width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px',
                        background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)',
                        color: '#10b981', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.2s',
                    }}>
                        View All Scans <ArrowUpRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
