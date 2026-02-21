import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Package, AlertTriangle, CheckCircle, ArrowUpRight, Clock, RefreshCw, Search } from 'lucide-react';
import ComplianceScoreWidget from '../components/widgets/ComplianceScoreWidget';
import ViolationTimeline from '../components/widgets/ViolationTimeline';
import ComplianceTrendChart from '../components/widgets/ComplianceTrendChart';
import StatusBadge from '../components/ui/StatusBadge';
import { getDashboardStats, getRecentScans, getTrendData, getEvaluatedProducts } from '../services/api';

const StatCard: React.FC<{ icon: React.ElementType; label: string; value: string | number; sub: string; color: string }> =
    ({ icon: Icon, label, value, sub, color }) => (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
                background: '#ffffff', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px',
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
            <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-1px' }}>{value}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>{sub}</div>
        </motion.div>
    );

const Dashboard: React.FC = () => {
    // State for dashboard data — all from live API
    const [stats, setStats] = useState<any>(null);
    const [recentScans, setRecentScans] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [evaluatedProducts, setEvaluatedProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    const fetchDashboardData = async (showRefresh = false) => {
        try {
            if (showRefresh) setRefreshing(true);
            else setLoading(true);

            const [statsData, scansData, trendsData, productsData] = await Promise.all([
                getDashboardStats(),
                getRecentScans(10),
                getTrendData(7),
                getEvaluatedProducts(),
            ]);

            setStats(statsData);
            setRecentScans(scansData.scans || []);
            setTrendData(trendsData.trends || []);
            setEvaluatedProducts(productsData.products || []);

            // Auto-select first product if none selected
            if (!selectedProduct && productsData.products?.length > 0) {
                setSelectedProduct(productsData.products[0]);
            }
            setError('');
        } catch (err: any) {
            console.error('Failed to load dashboard data:', err);
            setError(err.message || 'Failed to load dashboard data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(() => fetchDashboardData(true), 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
                <div style={{ color: '#64748b', fontSize: '14px' }}>Loading dashboard...</div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', flexDirection: 'column', gap: '12px' }}>
                <AlertTriangle size={40} color="#f43f5e" />
                <div style={{ color: '#f43f5e', fontSize: '14px' }}>{error}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>Make sure the backend server is running on port 8006</div>
            </div>
        );
    }

    // Aggregate violations from selected product or all products
    const allViolations = selectedProduct
        ? (selectedProduct.compliance?.violations || [])
        : evaluatedProducts.flatMap((p: any) => p.compliance?.violations || []).slice(0, 20);

    const complianceScore = selectedProduct?.compliance?.score || stats?.avg_compliance_score || 0;
    const totalRules = selectedProduct?.compliance?.total_rules || stats?.total_rules || 14;
    const passedRules = selectedProduct?.compliance?.passed_rules?.length || stats?.passed_rules_count || 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Page Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                            Dashboard
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            Live compliance data · Last updated{' '}
                            <span style={{ color: '#94a3b8' }}>{new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                    <button
                        onClick={() => fetchDashboardData(true)}
                        disabled={refreshing}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '8px',
                            background: refreshing ? '#f1f5f9' : '#f0fdf4',
                            border: '1px solid ' + (refreshing ? '#e2e8f0' : '#bbf7d0'),
                            color: refreshing ? '#94a3b8' : '#059669',
                            fontSize: '13px', fontWeight: 600, cursor: refreshing ? 'default' : 'pointer',
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>
            </motion.div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <StatCard icon={Activity} label="Avg Compliance Score" value={stats?.avg_compliance_score || 0} sub={stats?.products_scanned > 0 ? `From ${stats.products_scanned} scans` : 'No scans yet'} color="#10b981" />
                <StatCard icon={Package} label="Products Scanned" value={stats?.products_scanned || 0} sub="Total scans" color="#38bdf8" />
                <StatCard icon={AlertTriangle} label="Total Violations" value={stats?.total_violations || 0} sub={`${stats?.total_critical || 0} critical, ${stats?.total_high || 0} high`} color="#f43f5e" />
                <StatCard icon={CheckCircle} label="Rules Passing" value={`${stats?.rules_passing_percentage || 0}%`} sub={`${stats?.passed_rules_count || 0} / ${stats?.total_rules || 14} active rules`} color="#10b981" />
            </div>

            {/* Evaluated Products Grid */}
            {evaluatedProducts.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Search size={15} color="#94a3b8" /> Evaluated Products ({evaluatedProducts.length})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {evaluatedProducts.map((ep: any, i: number) => {
                            const p = ep.product;
                            const c = ep.compliance;
                            const isSelected = selectedProduct === ep;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    onClick={() => setSelectedProduct(ep)}
                                    style={{
                                        display: 'flex', gap: '12px', padding: '12px', borderRadius: '10px',
                                        border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                                        background: isSelected ? '#f0fdf4' : '#fafafa',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <img
                                        src={p?.product_image || 'https://via.placeholder.com/60'}
                                        alt={p?.name || ''}
                                        style={{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                                        onError={(e: any) => { e.target.src = 'https://via.placeholder.com/60'; }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p?.name || 'Unknown Product'}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                            {p?.platform || 'unknown'} · {p?.weight || ''} · ₹{p?.price || 'N/A'}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <span style={{
                                                fontSize: '14px', fontWeight: 800,
                                                color: (c?.score ?? 0) >= 80 ? '#10b981' : (c?.score ?? 0) >= 50 ? '#f59e0b' : '#f43f5e',
                                            }}>
                                                {c?.score ?? '—'}
                                            </span>
                                            <StatusBadge
                                                variant={c?.risk === 'Low' ? 'PASSED' : c?.risk === 'High' ? 'CRITICAL' : 'WARNING'}
                                                label={c?.risk || '—'}
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Main Grid: Score + Violations */}
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
                <ComplianceScoreWidget
                    score={complianceScore}
                    totalRules={totalRules}
                    passedRules={passedRules}
                />
                <ViolationTimeline violations={allViolations} />
            </div>

            {/* AI Analysis for selected product */}
            {selectedProduct?.ai_analysis && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: '#fff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            AI Analysis — {selectedProduct.product?.name}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ fontSize: '13px', color: '#64748b' }}>
                                Final: <span style={{ fontWeight: 800, color: (selectedProduct.compliance?.score ?? 0) >= 80 ? '#10b981' : (selectedProduct.compliance?.score ?? 0) >= 50 ? '#f59e0b' : '#f43f5e' }}>{selectedProduct.compliance?.score ?? '—'}/100</span>
                            </div>
                            {selectedProduct.ai_analysis.ai_score != null && (
                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                    AI: {selectedProduct.ai_analysis.ai_score}/100 · Rule: {selectedProduct.compliance?.rule_score ?? '—'}/100
                                </div>
                            )}
                            {selectedProduct.ai_analysis.deep_scrape_available === false && (
                                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                    Listing data only
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '12px' }}>
                        {selectedProduct.ai_analysis.summary}
                    </div>
                    {selectedProduct.ai_analysis.detailed_insights && (
                        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6, marginBottom: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                            {selectedProduct.ai_analysis.detailed_insights}
                        </div>
                    )}
                    {selectedProduct.ai_analysis.recommendations?.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Recommendations:</div>
                            {selectedProduct.ai_analysis.recommendations.map((rec: string, i: number) => (
                                <div key={i} style={{ fontSize: '12px', color: '#64748b', padding: '4px 0', paddingLeft: '12px', borderLeft: '2px solid #10b981' }}>
                                    {rec}
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            )}

            {/* Trend Chart */}
            <ComplianceTrendChart data={trendData} />

            {/* Recent Scans */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>
                {/* Product Detail (selected) */}
                {selectedProduct?.product && (
                    <div style={{ background: '#fff', border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>
                            Product Details
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                                ['Name', selectedProduct.product.name],
                                ['Platform', selectedProduct.product.platform],
                                ['Price', `₹${selectedProduct.product.price}`],
                                ['MRP', `₹${selectedProduct.product.mrp}`],
                                ['Weight', selectedProduct.product.weight],
                                ['FSSAI', selectedProduct.product.fssai_number],
                                ['Manufacturer', selectedProduct.product.manufacturer_name],
                                ['Expiry', selectedProduct.product.expiry_date],
                            ].map(([label, value], i) => (
                                <div key={i} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: '6px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                                    <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px', wordBreak: 'break-word' }}>{value || 'N/A'}</div>
                                </div>
                            ))}
                        </div>
                        {selectedProduct.product.ingredients && selectedProduct.product.ingredients !== 'N/A' && (
                            <div style={{ marginTop: '12px', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ingredients</div>
                                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', lineHeight: 1.5 }}>{selectedProduct.product.ingredients}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Scans Panel */}
                <div style={{
                    background: '#ffffff', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(226,232,240,0.8)', borderRadius: '12px', padding: '20px 24px',
                }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={15} color="#94a3b8" /> Recent Scans
                    </div>
                    {recentScans.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', fontSize: '13px' }}>
                            No scans yet. Try scanning a product from the Scanner page.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {recentScans.map((scan: any, i: number) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.07 }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 10px', borderRadius: '8px',
                                        background: 'rgba(241,245,249,0.7)', marginBottom: '4px',
                                        cursor: 'pointer', transition: 'background 0.2s',
                                    }}
                                    whileHover={{ background: 'rgba(226,232,240,0.8)' } as never}
                                >
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    )}
                    <button style={{
                        width: '100%', marginTop: '8px', padding: '10px', borderRadius: '8px',
                        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                        color: '#059669', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
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
