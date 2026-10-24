import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Search, ToggleRight } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

const categoryColors = {
    Licensing: '#a78bfa',
    Pricing: '#38bdf8',
    Labeling: '#fb923c',
    Content: '#10b981',
    Metrology: '#f59e0b',
    Safety: '#f43f5e',
    Traceability: '#94a3b8',
};

const RuleExplorer = ({ rules, onToggle }) => {
    const [activeTab, setActiveTab] = useState('All');
    const [search, setSearch] = useState('');
    const [localRules, setLocalRules] = useState(rules);

    const handleToggle = (id) => {
        setLocalRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
        const rule = localRules.find(r => r.id === id);
        if (rule && onToggle) onToggle(id, !rule.enabled);
    };

    const filtered = localRules.filter(r => {
        if (activeTab === 'Active' && !r.enabled) return false;
        if (activeTab === 'Disabled' && r.enabled) return false;
        if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.category.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const tabs = ['All', 'Active', 'Disabled'];
    const countByTab = {
        All: localRules.length,
        Active: localRules.filter(r => r.enabled).length,
        Disabled: localRules.filter(r => !r.enabled).length,
    };

    return (
        <div style={{ background: '#ffffff', backdropFilter: 'blur(16px)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={16} color="#94a3b8" />
                    Rule Explorer
                </div>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                    <Search size={13} color="#475569" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                        placeholder="Filter rules..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            background: 'rgba(241,245,249,0.9)', border: '1px solid rgba(203,213,225,0.8)',
                            borderRadius: '7px', padding: '6px 10px 6px 30px',
                            fontSize: '13px', color: '#0f172a', outline: 'none', width: '200px',
                        }}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(241,245,249,0.9)', borderRadius: '8px', padding: '4px' }}>
                {tabs.map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 500,
                            background: activeTab === tab ? '#ffffff' : 'transparent',
                            color: activeTab === tab ? '#0f172a' : '#64748b',
                            transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        }}
                    >
                        {tab}
                        <span style={{
                            background: activeTab === tab ? 'rgba(16,185,129,0.15)' : 'rgba(226,232,240,0.7)',
                            color: activeTab === tab ? '#10b981' : '#475569',
                            borderRadius: '4px', padding: '1px 6px', fontSize: '11px', fontWeight: 600,
                        }}>
                            {countByTab[tab]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
                {/* Table Header */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 90px 80px 48px',
                    gap: '8px', padding: '8px 12px',
                    background: 'rgba(241,245,249,0.9)', borderRadius: '7px', marginBottom: '6px',
                }}>
                    {['Rule Name', 'Category', 'Severity', 'Reg. Ref', 'Active'].map(h => (
                        <div key={h} style={{ fontSize: '11px', fontWeight: 600, color: '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</div>
                    ))}
                </div>

                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {filtered.map((rule, i) => (
                        <motion.div
                            key={rule.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            style={{
                                display: 'grid', gridTemplateColumns: '1fr 110px 90px 80px 48px',
                                gap: '8px', padding: '10px 12px', borderRadius: '7px',
                                background: rule.enabled ? 'rgba(248,250,252,0.7)' : 'rgba(241,245,249,0.4)',
                                border: '1px solid rgba(226,232,240,0.7)',
                                transition: 'background 0.2s',
                                alignItems: 'center',
                                opacity: rule.enabled ? 1 : 0.55,
                            }}
                        >
                            {/* Rule Name */}
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>{rule.name}</div>
                                <div style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rule.description}</div>
                            </div>

                            {/* Category */}
                            <span style={{
                                fontSize: '11px', fontWeight: 600,
                                color: categoryColors[rule.category] ?? '#94a3b8',
                                background: `${categoryColors[rule.category] ?? '#94a3b8'}18`,
                                border: `1px solid ${categoryColors[rule.category] ?? '#94a3b8'}30`,
                                borderRadius: '5px', padding: '3px 8px', whiteSpace: 'nowrap', display: 'inline-block',
                            }}>
                                {rule.category}
                            </span>

                            {/* Severity */}
                            <StatusBadge variant={rule.severity} size="sm" />

                            {/* Reg Ref */}
                            <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', lineHeight: '1.4' }}>
                                {rule.regulatory_ref.split(',')[0]}
                            </div>

                            {/* Toggle */}
                            <div
                                onClick={() => handleToggle(rule.id)}
                                title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                                style={{
                                    width: '36px', height: '20px', borderRadius: '10px', cursor: 'pointer',
                                    background: rule.enabled ? '#10b981' : 'rgba(203,213,225,0.8)',
                                    position: 'relative', transition: 'background 0.25s',
                                    boxShadow: rule.enabled ? '0 0 8px rgba(16,185,129,0.3)' : 'none',
                                    display: 'flex', alignItems: 'center', flexShrink: 0,
                                }}
                            >
                                <div style={{
                                    width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                                    position: 'absolute', left: rule.enabled ? '19px' : '3px',
                                    transition: 'left 0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: '#475569', fontSize: '14px' }}>
                        <ToggleRight size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                        No rules match your filter.
                    </div>
                )}
            </div>
        </div>
    );
};

export default RuleExplorer;
