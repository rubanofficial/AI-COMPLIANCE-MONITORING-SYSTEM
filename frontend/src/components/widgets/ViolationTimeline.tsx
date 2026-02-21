import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertOctagon, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Violation } from '../../types';
import StatusBadge from '../ui/StatusBadge';

interface ViolationTimelineProps {
    violations: Violation[];
    loading?: boolean;
}

const severityConfig = {
    CRITICAL: { icon: AlertOctagon, color: '#f43f5e', bg: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.3)' },
    HIGH: { icon: AlertTriangle, color: '#fb7185', bg: 'rgba(244,63,94,0.05)', borderColor: 'rgba(244,63,94,0.2)' },
    MEDIUM: { icon: ShieldAlert, color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.2)' },
    LOW: { icon: Info, color: '#94a3b8', bg: 'rgba(100,116,139,0.05)', borderColor: 'rgba(100,116,139,0.2)' },
    INFO: { icon: Info, color: '#38bdf8', bg: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.2)' },
};

const SkeletonItem: React.FC = () => (
    <div style={{ display: 'flex', gap: '12px', padding: '14px 0' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(226,232,240,0.6)', flexShrink: 0, animation: 'shimmer 1.5s ease-in-out infinite' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ width: '60%', height: '14px', borderRadius: '4px', background: 'rgba(226,232,240,0.6)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            <div style={{ width: '90%', height: '12px', borderRadius: '4px', background: 'rgba(226,232,240,0.5)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
        </div>
    </div>
);

const ViolationTimeline: React.FC<ViolationTimelineProps> = ({ violations, loading }) => {
    if (loading) {
        return (
            <div style={{
                background: '#ffffff', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px',
            }}>
                <div style={{ width: '160px', height: '18px', borderRadius: '5px', background: 'rgba(226,232,240,0.6)', marginBottom: '20px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                {[1, 2, 3].map(i => <SkeletonItem key={i} />)}
            </div>
        );
    }

    return (
        <div style={{
            background: '#ffffff', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px',
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={16} color="#f43f5e" />
                    Violation Timeline
                </div>
                <span style={{
                    background: violations.length > 0 ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${violations.length > 0 ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    borderRadius: '6px', padding: '3px 10px',
                    fontSize: '12px', fontWeight: 600,
                    color: violations.length > 0 ? '#f43f5e' : '#10b981',
                }}>
                    {violations.length} {violations.length === 1 ? 'Violation' : 'Violations'}
                </span>
            </div>

            {/* Empty state */}
            {violations.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
                        padding: '32px', color: '#10b981',
                    }}
                >
                    <CheckCircle2 size={40} />
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>All Rules Passed</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>This product meets all compliance requirements.</div>
                </motion.div>
            )}

            {/* Timeline */}
            <div style={{ position: 'relative' }}>
                {/* Vertical line */}
                {violations.length > 0 && (
                    <div style={{
                        position: 'absolute', left: '15px', top: '8px', bottom: '8px',
                        width: '1px', background: 'rgba(226,232,240,0.9)', zIndex: 0,
                    }} />
                )}

                <AnimatePresence>
                    {violations.map((v, i) => {
                        const severity = (v.severity || 'MEDIUM').toUpperCase() as keyof typeof severityConfig;
                        const cfg = severityConfig[severity] || severityConfig.MEDIUM;
                        const Icon = cfg.icon || ShieldAlert;

                        return (
                            <motion.div
                                key={v.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.35, delay: i * 0.08 }}
                                style={{
                                    display: 'flex', gap: '12px', padding: '10px 0',
                                    borderBottom: i < violations.length - 1 ? '1px solid rgba(226,232,240,0.6)' : 'none',
                                    position: 'relative', zIndex: 1,
                                }}
                            >
                                {/* Icon */}
                                <div style={{
                                    width: '28px', height: '28px', borderRadius: '6px',
                                    background: cfg.bg, border: `1px solid ${cfg.borderColor}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Icon size={14} color={cfg.color} />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{v.rule}</span>
                                        <StatusBadge variant={v.severity} size="sm" />
                                        {v.field && (
                                            <span style={{
                                                fontSize: '10px', color: '#475569', fontFamily: 'monospace',
                                                background: 'rgba(226,232,240,0.7)', padding: '0px 5px', borderRadius: '3px',
                                            }}>
                                                .{v.field}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4', margin: 0 }}>{v.message}</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default ViolationTimeline;
