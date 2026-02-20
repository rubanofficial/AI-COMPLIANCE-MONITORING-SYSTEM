import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Award, AlertTriangle } from 'lucide-react';

interface ComplianceScoreWidgetProps {
    score: number;
    totalRules: number;
    passedRules: number;
    loading?: boolean;
}

const getScoreColor = (score: number) => {
    if (score >= 80) return { stroke: '#10b981', glow: 'rgba(16,185,129,0.25)', label: '#10b981', bg: 'rgba(16,185,129,0.08)' };
    if (score >= 50) return { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.25)', label: '#f59e0b', bg: 'rgba(245,158,11,0.08)' };
    return { stroke: '#f43f5e', glow: 'rgba(244,63,94,0.25)', label: '#f43f5e', bg: 'rgba(244,63,94,0.08)' };
};

const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Compliant';
    if (score >= 50) return 'At Risk';
    return 'Non-Compliant';
};

const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ComplianceScoreWidget: React.FC<ComplianceScoreWidgetProps> = ({ score, totalRules, passedRules, loading }) => {
    const [animatedScore, setAnimatedScore] = useState(0);
    const colors = getScoreColor(score);
    const offset = CIRCUMFERENCE - (animatedScore / 100) * CIRCUMFERENCE;

    useEffect(() => {
        if (loading) { setAnimatedScore(0); return; }
        const duration = 1200;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimatedScore(Math.round(eased * score));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [score, loading]);

    if (loading) {
        return (
            <div style={{
                background: '#ffffff', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '28px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            }}>
                <div style={{ width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(226,232,240,0.6)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                <div style={{ width: '100px', height: '20px', borderRadius: '6px', background: 'rgba(226,232,240,0.6)', animation: 'shimmer 1.5s ease-in-out infinite' }} />
            </div>
        );
    }

    return (
        <div style={{
            background: '#ffffff', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            boxShadow: `0 0 40px ${colors.glow}`,
        }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={14} color="#10b981" /> Compliance Score
            </div>

            {/* Circular Gauge */}
            <div style={{ position: 'relative' }}>
                <svg width="180" height="180" viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Track */}
                    <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="rgba(226,232,240,0.9)" strokeWidth="12" />
                    {/* Progress */}
                    <circle
                        cx="90" cy="90" r={RADIUS}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={CIRCUMFERENCE}
                        strokeDashoffset={offset}
                        style={{ filter: `drop-shadow(0 0 8px ${colors.stroke}88)`, transition: 'stroke 0.3s' }}
                    />
                </svg>
                {/* Center content */}
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                    <motion.div
                        key={score}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}
                        style={{
                            fontSize: '42px', fontWeight: 800, color: colors.label,
                            lineHeight: 1, letterSpacing: '-2px',
                            textShadow: `0 0 20px ${colors.label}55`,
                        }}
                    >
                        {animatedScore}
                    </motion.div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>/100</div>
                </div>
            </div>

            {/* Score Label */}
            <div style={{
                background: colors.bg,
                border: `1px solid ${colors.stroke}33`,
                borderRadius: '8px',
                padding: '6px 20px',
                fontSize: '14px', fontWeight: 700,
                color: colors.label,
                letterSpacing: '0.3px',
                display: 'flex', alignItems: 'center', gap: '6px',
            }}>
                {score >= 80 ? <TrendingUp size={14} /> : <AlertTriangle size={14} />}
                {getScoreLabel(score)}
            </div>

            {/* Stats Row */}
            <div style={{ display: 'flex', gap: '24px', width: '100%', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#10b981' }}>{passedRules}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Passed</div>
                </div>
                <div style={{ width: '1px', background: 'rgba(226,232,240,0.9)' }} />
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#f43f5e' }}>{totalRules - passedRules}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Failed</div>
                </div>
                <div style={{ width: '1px', background: 'rgba(226,232,240,0.9)' }} />
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: '#94a3b8' }}>{totalRules}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Total</div>
                </div>
            </div>
        </div>
    );
};

export default ComplianceScoreWidget;
