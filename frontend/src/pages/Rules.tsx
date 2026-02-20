import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import RuleExplorer from '../components/widgets/RuleExplorer';
import type { ComplianceRule } from '../types';
import { mockComplianceRules } from '../data/mockData';

const Rules: React.FC = () => {
    const activeCount = mockComplianceRules.filter(r => r.enabled).length;
    const criticalCount = mockComplianceRules.filter(r => r.severity === 'CRITICAL').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>
                    Compliance Rules
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    Manage and configure the FSSAI &amp; regulatory rules applied during product evaluation.
                </div>
            </motion.div>

            {/* Rule Summary Pills */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                    { label: 'Total Rules', value: mockComplianceRules.length, color: '#94a3b8' },
                    { label: 'Active', value: activeCount, color: '#10b981' },
                    { label: 'Disabled', value: mockComplianceRules.length - activeCount, color: '#475569' },
                    { label: 'Critical Rules', value: criticalCount, color: '#f43f5e' },
                ].map(({ label, value, color }, i) => (
                    <motion.div
                        key={label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        style={{
                            background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
                            border: `1px solid rgba(71,85,105,0.3)`, borderRadius: '10px',
                            padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '14px',
                        }}
                    >
                        <div style={{ fontSize: '28px', fontWeight: 800, color, letterSpacing: '-1px' }}>{value}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{label}</div>
                    </motion.div>
                ))}
            </div>

            {/* Full Rule Explorer */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <RuleExplorer rules={mockComplianceRules} />
            </motion.div>

            {/* Regulatory Footer */}
            <div style={{
                background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: '10px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
            }}>
                <BookOpen size={16} color="#10b981" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                    Rules enforced under <span style={{ color: '#94a3b8', fontWeight: 500 }}>Food Safety &amp; Standards Act 2006</span>,{' '}
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Legal Metrology Act 2009</span>, and{' '}
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Consumer Protection Act 2019</span>.
                    Disabled rules are excluded from scoring but still logged for auditing purposes.
                </div>
            </div>
        </div>
    );
};

export default Rules;
