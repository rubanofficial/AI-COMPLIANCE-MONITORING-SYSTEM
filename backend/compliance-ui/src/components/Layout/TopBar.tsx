import React, { useState } from 'react';
import { Bell, Search, Wifi, Database, Cpu } from 'lucide-react';

interface StatusPill {
    label: string;
    status: 'online' | 'warning' | 'offline';
    icon: React.ElementType;
}

const statusItems: StatusPill[] = [
    { label: 'API Online', status: 'online', icon: Wifi },
    { label: 'AI Engine', status: 'online', icon: Cpu },
    { label: 'Rules DB', status: 'warning', icon: Database },
];

const statusColors = {
    online: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.25)', text: '#10b981', dot: '#10b981' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.25)', text: '#f59e0b', dot: '#f59e0b' },
    offline: { bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.25)', text: '#f43f5e', dot: '#f43f5e' },
};

const TopBar: React.FC = () => {
    const [searchValue, setSearchValue] = useState('');

    return (
        <header style={{
            height: '64px',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 40,
        }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
                <Search size={16} color="#475569" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                    type="text"
                    placeholder="Search products, rules, reports..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    style={{
                        width: '100%',
                        background: 'rgba(30, 41, 59, 0.6)',
                        border: '1px solid rgba(51, 65, 85, 0.4)',
                        borderRadius: '8px',
                        padding: '8px 12px 8px 38px',
                        fontSize: '14px',
                        color: '#e2e8f0',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'rgba(16, 185, 129, 0.4)')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(51, 65, 85, 0.4)')}
                />
            </div>

            {/* Status Pills + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Status Pills */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    {statusItems.map(({ label, status, icon: Icon }) => {
                        const colors = statusColors[status];
                        return (
                            <div
                                key={label}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: colors.bg,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: colors.text,
                                    cursor: 'default',
                                }}
                            >
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%', background: colors.dot,
                                    boxShadow: `0 0 6px ${colors.dot}`,
                                    animation: status === 'online' ? 'pulse 2s infinite' : 'none',
                                }} />
                                <Icon size={12} />
                                <span>{label}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Divider */}
                <div style={{ width: '1px', height: '28px', background: 'rgba(51, 65, 85, 0.5)' }} />

                {/* Bell */}
                <button style={{
                    position: 'relative',
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(51, 65, 85, 0.4)',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                }}>
                    <Bell size={16} color="#94a3b8" />
                    <span style={{
                        position: 'absolute',
                        top: '6px', right: '6px',
                        width: '8px', height: '8px',
                        background: '#f43f5e',
                        borderRadius: '50%',
                        border: '2px solid #0f172a',
                        boxShadow: '0 0 6px rgba(244, 63, 94, 0.5)',
                    }} />
                </button>

                {/* Avatar */}
                <div style={{
                    width: '36px', height: '36px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', fontWeight: 700, color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.2)',
                }}>
                    A
                </div>
            </div>

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
        </header>
    );
};

export default TopBar;
