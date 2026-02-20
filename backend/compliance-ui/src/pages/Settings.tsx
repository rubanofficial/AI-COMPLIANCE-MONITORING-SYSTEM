import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Server, Bell, Shield, Key, Save, RotateCcw } from 'lucide-react';

const SettingSection: React.FC<{ title: string; icon: React.ElementType; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div style={{ background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', padding: '20px 24px', marginBottom: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Icon size={14} /> {title}
        </div>
        {children}
    </div>
);

const SettingRow: React.FC<{ label: string; sub?: string; children: React.ReactNode }> = ({ label, sub, children }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(51,65,85,0.2)' }}>
        <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#cbd5e1' }}>{label}</div>
            {sub && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{sub}</div>}
        </div>
        <div>{children}</div>
    </div>
);

const Toggle: React.FC<{ defaultOn?: boolean }> = ({ defaultOn = true }) => {
    const [on, setOn] = useState(defaultOn);
    return (
        <div onClick={() => setOn(!on)} style={{ width: '40px', height: '22px', borderRadius: '11px', cursor: 'pointer', background: on ? '#10b981' : 'rgba(51,65,85,0.6)', position: 'relative', transition: 'background 0.25s', boxShadow: on ? '0 0 8px rgba(16,185,129,0.3)' : 'none' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', left: on ? '21px' : '3px', top: '3px', transition: 'left 0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </div>
    );
};

const Settings: React.FC = () => {
    const [apiUrl, setApiUrl] = useState('http://localhost:8000');
    const [geminiKey, setGeminiKey] = useState('AIza••••••••••••••••••••••••••••');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', maxWidth: '760px' }}>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#e2e8f0', letterSpacing: '-0.5px' }}>Settings</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Configure API endpoints, notifications, and system preferences.</div>
            </motion.div>

            {/* API Config */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <SettingSection title="API Configuration" icon={Server}>
                    <SettingRow label="Backend URL" sub="URL for the /evaluate and /rules endpoints">
                        <input
                            value={apiUrl}
                            onChange={e => setApiUrl(e.target.value)}
                            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#cbd5e1', outline: 'none', width: '240px', fontFamily: 'monospace' }}
                        />
                    </SettingRow>
                    <SettingRow label="Request Timeout" sub="Maximum time in seconds before API call fails">
                        <select style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#cbd5e1', outline: 'none' }}>
                            <option>30 seconds</option>
                            <option>60 seconds</option>
                            <option>120 seconds</option>
                        </select>
                    </SettingRow>
                    <SettingRow label="Mock Mode" sub="Use mock data instead of live /evaluate API">
                        <Toggle defaultOn={true} />
                    </SettingRow>
                </SettingSection>
            </motion.div>

            {/* AI Config */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <SettingSection title="AI Engine" icon={Key}>
                    <SettingRow label="Gemini API Key" sub="Used for AI-powered compliance analysis">
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={e => setGeminiKey(e.target.value)}
                            style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#cbd5e1', outline: 'none', width: '240px', fontFamily: 'monospace' }}
                        />
                    </SettingRow>
                    <SettingRow label="AI Model" sub="Gemini model for scoring and analysis">
                        <select style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#cbd5e1', outline: 'none' }}>
                            <option>gemini-1.5-pro</option>
                            <option>gemini-1.5-flash</option>
                            <option>gemini-2.0-flash</option>
                        </select>
                    </SettingRow>
                    <SettingRow label="AI Insights" sub="Show AI-generated compliance insights in Scanner">
                        <Toggle defaultOn={true} />
                    </SettingRow>
                </SettingSection>
            </motion.div>

            {/* Notifications */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <SettingSection title="Notifications" icon={Bell}>
                    <SettingRow label="Critical Violation Alerts" sub="Notify on CRITICAL severity violations">
                        <Toggle defaultOn={true} />
                    </SettingRow>
                    <SettingRow label="Score Drop Alerts" sub="Notify when compliance score drops below 60">
                        <Toggle defaultOn={true} />
                    </SettingRow>
                    <SettingRow label="Daily Summary" sub="Email daily compliance digest at 9:00 AM">
                        <Toggle defaultOn={false} />
                    </SettingRow>
                </SettingSection>
            </motion.div>

            {/* Compliance Thresholds */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <SettingSection title="Compliance Thresholds" icon={Shield}>
                    <SettingRow label="Compliant Score Threshold" sub="Score ≥ this value is considered compliant (green)">
                        <input type="number" defaultValue={80} min={0} max={100} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#10b981', outline: 'none', width: '80px', textAlign: 'center', fontWeight: 700 }} />
                    </SettingRow>
                    <SettingRow label="At-Risk Score Threshold" sub="Score ≥ this value is flagged as at-risk (amber)">
                        <input type="number" defaultValue={50} min={0} max={100} style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#f59e0b', outline: 'none', width: '80px', textAlign: 'center', fontWeight: 700 }} />
                    </SettingRow>
                </SettingSection>
            </motion.div>

            {/* Actions */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ display: 'flex', gap: '12px' }}>
                <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
                    fontSize: '14px', fontWeight: 700, boxShadow: '0 0 16px rgba(16,185,129,0.2)',
                }}>
                    <Save size={15} /> Save Settings
                </button>
                <button style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 24px', borderRadius: '10px',
                    background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)',
                    color: '#94a3b8', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}>
                    <RotateCcw size={15} /> Reset to Defaults
                </button>
            </motion.div>
        </div>
    );
};

export default Settings;
