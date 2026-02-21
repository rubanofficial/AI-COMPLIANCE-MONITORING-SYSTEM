import React from 'react';

type Variant = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PASSED' | 'FAILED' | 'WARNING' | 'ONLINE' | 'OFFLINE' | 'INFO';

interface StatusBadgeProps {
    variant: Variant;
    label?: string;
    size?: 'sm' | 'md';
}

const variantStyles: Record<Variant, { bg: string; border: string; text: string; dot: string }> = {
    CRITICAL: { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.35)', text: '#f43f5e', dot: '#f43f5e' },
    HIGH: { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.25)', text: '#fb7185', dot: '#fb7185' },
    FAILED: { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.25)', text: '#fb7185', dot: '#fb7185' },
    MEDIUM: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b', dot: '#f59e0b' },
    WARNING: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b', dot: '#f59e0b' },
    LOW: { bg: 'rgba(100, 116, 139, 0.15)', border: 'rgba(100, 116, 139, 0.3)', text: '#94a3b8', dot: '#94a3b8' },
    PASSED: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#10b981', dot: '#10b981' },
    ONLINE: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#10b981', dot: '#10b981' },
    OFFLINE: { bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.25)', text: '#f43f5e', dot: '#f43f5e' },
    INFO: { bg: 'rgba(56, 189, 248, 0.08)', border: 'rgba(56, 189, 248, 0.25)', text: '#38bdf8', dot: '#38bdf8' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label, size = 'md' }) => {
    const styles = variantStyles[variant];
    const displayLabel = label ?? variant;

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: size === 'sm' ? '4px' : '5px',
            background: styles.bg,
            border: `1px solid ${styles.border}`,
            borderRadius: '5px',
            padding: size === 'sm' ? '2px 7px' : '3px 9px',
            fontSize: size === 'sm' ? '11px' : '12px',
            fontWeight: 600,
            color: styles.text,
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
        }}>
            <span style={{
                width: size === 'sm' ? '5px' : '6px',
                height: size === 'sm' ? '5px' : '6px',
                borderRadius: '50%',
                background: styles.dot,
                boxShadow: `0 0 5px ${styles.dot}55`,
                flexShrink: 0,
            }} />
            {displayLabel}
        </span>
    );
};

export default StatusBadge;
