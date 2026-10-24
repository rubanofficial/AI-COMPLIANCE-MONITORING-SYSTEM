import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    ScanLine,
    BookOpen,
    Settings,
    ShieldCheck,
    Zap,
} from 'lucide-react';

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/scanner', icon: ScanLine, label: 'Scanner' },
    { to: '/rules', icon: BookOpen, label: 'Rules' },
    { to: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar = () => {
    return (
        <aside
            style={{
                width: '240px',
                minWidth: '240px',
                height: '100vh',
                background: '#ffffff',
                backdropFilter: 'blur(20px)',
                borderRight: '1px solid rgba(226, 232, 240, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                padding: '0',
                position: 'fixed',
                left: 0,
                top: 0,
                zIndex: 50,
            }}
        >
            {/* Brand */}
            <div style={{
                padding: '24px 20px 20px',
                borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
                }}>
                    <ShieldCheck size={20} color="white" />
                </div>
                <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
                        ComplianceAI
                    </div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.5px' }}>
                        QUICK COMMERCE
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ padding: '16px 12px', flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.8px', marginBottom: '8px', paddingLeft: '8px' }}>
                    MAIN MENU
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>

            {/* Bottom Status */}
            <div style={{
                padding: '16px 12px',
                borderTop: '1px solid rgba(226, 232, 240, 0.8)',
            }}>
                <div style={{
                    background: 'rgba(16, 185, 129, 0.07)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <Zap size={14} color="#10b981" />
                    <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>AI Engine Active</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Gemini 1.5 Pro</div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
