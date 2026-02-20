import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ChevronLeft, ChevronRight, Tag, Package, ShieldCheck,
    Info, AlertTriangle, Loader2, ExternalLink, ImageOff,
    Building2, MapPin, Calendar, Utensils, Award, Globe
} from 'lucide-react';
import type { ProductDetail } from '../../types';

interface ProductDetailModalProps {
    open: boolean;
    onClose: () => void;
    loading: boolean;
    error: string;
    detail: ProductDetail | null;
    productName?: string;
    platform?: string;
    productUrl?: string;
}

const NA_DISPLAY = '—';

const formatVal = (v: string | undefined | null) =>
    !v || v === 'N/A' ? NA_DISPLAY : v;

const HighlightItem: React.FC<{ icon?: React.ElementType; label: string; value: string }> = ({
    icon: Icon,
    label,
    value,
}) => (
    <div
        style={{
            background: 'rgba(15,23,42,0.5)',
            border: '1px solid rgba(51,65,85,0.35)',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
        }}
    >
        <div
            style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#475569',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}
        >
            {Icon && <Icon size={10} color="#475569" />}
            {label}
        </div>
        <div
            style={{
                fontSize: '13px',
                fontWeight: 500,
                color: value === NA_DISPLAY ? '#334155' : '#cbd5e1',
                wordBreak: 'break-word',
            }}
        >
            {value}
        </div>
    </div>
);

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; color?: string }> = ({
    icon: Icon,
    title,
    color = '#94a3b8',
}) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            marginBottom: '12px',
            paddingBottom: '8px',
            borderBottom: '1px solid rgba(51,65,85,0.3)',
        }}
    >
        <Icon size={14} color={color} />
        {title}
    </div>
);

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
    open,
    onClose,
    loading,
    error,
    detail,
    productName,
    platform,
    productUrl,
}) => {
    const [imgIdx, setImgIdx] = useState(0);
    const [imgError, setImgError] = useState<Record<number, boolean>>({});

    const images = detail?.images ?? [];
    const validImages = images.filter((_, i) => !imgError[i]);

    const prevImg = useCallback(() => {
        setImgIdx(i => (i - 1 + validImages.length) % validImages.length);
    }, [validImages.length]);
    const nextImg = useCallback(() => {
        setImgIdx(i => (i + 1) % validImages.length);
    }, [validImages.length]);

    if (!open) return null;

    const platformColor = platform === 'zepto' ? '#a78bfa' : '#10b981';

    // Compute price savings
    const priceNum = parseFloat(detail?.price ?? '0');
    const mrpNum = parseFloat(detail?.mrp ?? '0');
    const savingsAmount =
        !isNaN(priceNum) && !isNaN(mrpNum) && mrpNum > priceNum
            ? `₹${(mrpNum - priceNum).toFixed(0)}`
            : null;

    // Build extra highlight rows from the scraped highlights dict
    const highlightEntries = Object.entries(detail?.highlights ?? {}).slice(0, 20);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(2,6,23,0.85)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 1000,
                        }}
                    />

                    {/* Modal */}
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 'min(92vw, 960px)',
                            maxHeight: '90vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'rgba(15,23,42,0.98)',
                            border: '1px solid rgba(51,65,85,0.5)',
                            borderRadius: '16px',
                            zIndex: 1001,
                            boxShadow: '0 25px 80px rgba(0,0,0,0.7)',
                        }}
                    >
                        {/* ─── Header ─────────────────────────────────────── */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '16px 24px',
                                borderBottom: '1px solid rgba(51,65,85,0.4)',
                                flexShrink: 0,
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        background: `${platformColor}20`,
                                        border: `1px solid ${platformColor}40`,
                                        color: platformColor,
                                        borderRadius: '5px',
                                        padding: '2px 8px',
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {platform ?? 'Platform'}
                                </span>
                                <span
                                    style={{
                                        fontSize: '15px',
                                        fontWeight: 700,
                                        color: '#e2e8f0',
                                        maxWidth: '500px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {detail?.product_name ?? productName ?? 'Product Details'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {productUrl && (
                                    <a
                                        href={productUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '12px',
                                            color: '#64748b',
                                            textDecoration: 'none',
                                            background: 'rgba(30,41,59,0.6)',
                                            border: '1px solid rgba(51,65,85,0.4)',
                                            borderRadius: '6px',
                                            padding: '5px 10px',
                                        }}
                                    >
                                        <ExternalLink size={12} /> View on Site
                                    </a>
                                )}
                                <button
                                    onClick={onClose}
                                    style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: 'rgba(30,41,59,0.6)',
                                        border: '1px solid rgba(51,65,85,0.4)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <X size={16} color="#94a3b8" />
                                </button>
                            </div>
                        </div>

                        {/* ─── Body ───────────────────────────────────────── */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* Loading state */}
                            {loading && (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '80px 40px',
                                        gap: '16px',
                                    }}
                                >
                                    <Loader2
                                        size={40}
                                        color="#10b981"
                                        style={{ animation: 'spin 1s linear infinite' }}
                                    />
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#94a3b8' }}>
                                        Fetching product details...
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#475569' }}>
                                        Scraping {platform} product page — this may take 10–20 seconds
                                    </div>
                                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                                </div>
                            )}

                            {/* Error state */}
                            {!loading && error && (
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '80px 40px',
                                        gap: '14px',
                                    }}
                                >
                                    <AlertTriangle size={40} color="#f43f5e" />
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#f43f5e' }}>
                                        Failed to load details
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '400px', textAlign: 'center' }}>
                                        {error}
                                    </div>
                                </div>
                            )}

                            {/* Detail content */}
                            {!loading && !error && detail && (
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '340px 1fr',
                                        gap: '0',
                                    }}
                                >
                                    {/* ── LEFT: Image Gallery ────────────────── */}
                                    <div
                                        style={{
                                            borderRight: '1px solid rgba(51,65,85,0.3)',
                                            padding: '24px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                        }}
                                    >
                                        {/* Main Image */}
                                        <div
                                            style={{
                                                position: 'relative',
                                                background: 'rgba(30,41,59,0.4)',
                                                border: '1px solid rgba(51,65,85,0.3)',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                aspectRatio: '1 / 1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {validImages.length > 0 ? (
                                                <>
                                                    <img
                                                        src={validImages[imgIdx] ?? ''}
                                                        alt={detail.product_name}
                                                        style={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'contain',
                                                            padding: '12px',
                                                        }}
                                                        onError={() =>
                                                            setImgError(prev => ({ ...prev, [imgIdx]: true }))
                                                        }
                                                    />
                                                    {validImages.length > 1 && (
                                                        <>
                                                            <button
                                                                onClick={prevImg}
                                                                style={{
                                                                    position: 'absolute',
                                                                    left: '8px',
                                                                    top: '50%',
                                                                    transform: 'translateY(-50%)',
                                                                    background: 'rgba(15,23,42,0.8)',
                                                                    border: '1px solid rgba(51,65,85,0.5)',
                                                                    borderRadius: '50%',
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                <ChevronLeft size={14} color="#94a3b8" />
                                                            </button>
                                                            <button
                                                                onClick={nextImg}
                                                                style={{
                                                                    position: 'absolute',
                                                                    right: '8px',
                                                                    top: '50%',
                                                                    transform: 'translateY(-50%)',
                                                                    background: 'rgba(15,23,42,0.8)',
                                                                    border: '1px solid rgba(51,65,85,0.5)',
                                                                    borderRadius: '50%',
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >
                                                                <ChevronRight size={14} color="#94a3b8" />
                                                            </button>
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    bottom: '10px',
                                                                    left: '50%',
                                                                    transform: 'translateX(-50%)',
                                                                    fontSize: '11px',
                                                                    color: '#94a3b8',
                                                                    background: 'rgba(15,23,42,0.7)',
                                                                    borderRadius: '10px',
                                                                    padding: '2px 8px',
                                                                }}
                                                            >
                                                                {imgIdx + 1} / {validImages.length}
                                                            </div>
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        color: '#334155',
                                                    }}
                                                >
                                                    <ImageOff size={40} />
                                                    <span style={{ fontSize: '12px' }}>No images available</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Thumbnail Strip */}
                                        {validImages.length > 1 && (
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    gap: '8px',
                                                    overflowX: 'auto',
                                                    paddingBottom: '4px',
                                                }}
                                            >
                                                {validImages.slice(0, 8).map((src, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => setImgIdx(i)}
                                                        style={{
                                                            width: '52px',
                                                            height: '52px',
                                                            borderRadius: '7px',
                                                            overflow: 'hidden',
                                                            cursor: 'pointer',
                                                            border: `2px solid ${i === imgIdx ? platformColor : 'rgba(51,65,85,0.4)'}`,
                                                            flexShrink: 0,
                                                            background: 'rgba(30,41,59,0.4)',
                                                        }}
                                                    >
                                                        <img
                                                            src={src}
                                                            alt=""
                                                            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '3px' }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Price Card */}
                                        <div
                                            style={{
                                                background: 'rgba(30,41,59,0.5)',
                                                border: '1px solid rgba(51,65,85,0.3)',
                                                borderRadius: '10px',
                                                padding: '16px',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '8px' }}>
                                                <span
                                                    style={{
                                                        fontSize: '28px',
                                                        fontWeight: 800,
                                                        color: '#10b981',
                                                        letterSpacing: '-1px',
                                                    }}
                                                >
                                                    {detail.price !== 'N/A' ? `₹${detail.price}` : NA_DISPLAY}
                                                </span>
                                                {detail.mrp && detail.mrp !== 'N/A' && (
                                                    <span
                                                        style={{
                                                            fontSize: '14px',
                                                            color: '#475569',
                                                            textDecoration: 'line-through',
                                                            marginBottom: '4px',
                                                        }}
                                                    >
                                                        ₹{detail.mrp}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                {detail.discount && detail.discount !== 'N/A' && (
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            background: 'rgba(16,185,129,0.15)',
                                                            border: '1px solid rgba(16,185,129,0.3)',
                                                            color: '#10b981',
                                                            borderRadius: '5px',
                                                            padding: '2px 8px',
                                                        }}
                                                    >
                                                        {detail.discount}
                                                    </span>
                                                )}
                                                {savingsAmount && (
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            color: '#64748b',
                                                            alignSelf: 'center',
                                                        }}
                                                    >
                                                        Save {savingsAmount}
                                                    </span>
                                                )}
                                                {detail.weight && detail.weight !== 'N/A' && (
                                                    <span
                                                        style={{
                                                            fontSize: '11px',
                                                            background: 'rgba(51,65,85,0.4)',
                                                            color: '#94a3b8',
                                                            borderRadius: '5px',
                                                            padding: '2px 8px',
                                                        }}
                                                    >
                                                        {detail.weight}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── RIGHT: Product Info ────────────────── */}
                                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                        {/* Quick Highlights Grid */}
                                        <section>
                                            <SectionHeader icon={Tag} title="Key Highlights" color="#10b981" />
                                            <div
                                                style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
                                                    gap: '8px',
                                                }}
                                            >
                                                <HighlightItem icon={Award} label="Brand" value={formatVal(detail.brand)} />
                                                <HighlightItem icon={Package} label="Weight" value={formatVal(detail.weight)} />
                                                <HighlightItem icon={Globe} label="Origin" value={formatVal(detail.country_of_origin)} />
                                                <HighlightItem icon={Tag} label="Category" value={formatVal(detail.category)} />
                                            </div>
                                        </section>

                                        {/* Extra highlights from scraper */}
                                        {highlightEntries.length > 0 && (
                                            <section>
                                                <SectionHeader icon={Info} title="Product Details" color="#38bdf8" />
                                                <div
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                                                        gap: '8px',
                                                    }}
                                                >
                                                    {highlightEntries.map(([k, v]) => (
                                                        <HighlightItem key={k} label={k} value={formatVal(v)} />
                                                    ))}
                                                </div>
                                            </section>
                                        )}

                                        {/* Regulatory / Compliance Info */}
                                        <section>
                                            <SectionHeader icon={ShieldCheck} title="Regulatory & Label Info" color="#a78bfa" />
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <HighlightItem icon={ShieldCheck} label="FSSAI Number" value={formatVal(detail.fssai_number)} />
                                                <HighlightItem icon={Calendar} label="Expiry / Best Before" value={formatVal(detail.expiry_date)} />
                                                <HighlightItem icon={Building2} label="Manufacturer" value={formatVal(detail.manufacturer_name)} />
                                                {detail.seller_name && detail.seller_name !== 'N/A' && (
                                                    <HighlightItem icon={Building2} label="Seller" value={formatVal(detail.seller_name)} />
                                                )}
                                                {detail.shelf_life && detail.shelf_life !== 'N/A' && (
                                                    <HighlightItem icon={Building2} label="Shelf Life" value={formatVal(detail.shelf_life)} />
                                                )}
                                                <HighlightItem icon={MapPin} label="Manufacturer Address" value={formatVal(detail.manufacturer_address)} />
                                            </div>
                                        </section>

                                        {/* Ingredients */}
                                        {detail.ingredients && detail.ingredients !== 'N/A' && (
                                            <section>
                                                <SectionHeader icon={Utensils} title="Ingredients" color="#f59e0b" />
                                                <div
                                                    style={{
                                                        background: 'rgba(15,23,42,0.4)',
                                                        border: '1px solid rgba(51,65,85,0.3)',
                                                        borderRadius: '8px',
                                                        padding: '12px 14px',
                                                        fontSize: '12px',
                                                        color: '#94a3b8',
                                                        lineHeight: '1.7',
                                                    }}
                                                >
                                                    {detail.ingredients}
                                                </div>
                                            </section>
                                        )}

                                        {/* Description */}
                                        {detail.description && detail.description !== 'N/A' && (
                                            <section>
                                                <SectionHeader icon={Info} title="About This Product" color="#64748b" />
                                                <div
                                                    style={{
                                                        background: 'rgba(15,23,42,0.4)',
                                                        border: '1px solid rgba(51,65,85,0.3)',
                                                        borderRadius: '8px',
                                                        padding: '12px 14px',
                                                        fontSize: '12px',
                                                        color: '#94a3b8',
                                                        lineHeight: '1.7',
                                                    }}
                                                >
                                                    {detail.description}
                                                </div>
                                            </section>
                                        )}

                                        {/* Nutritional Info */}
                                        {detail.nutritional_info && detail.nutritional_info !== 'N/A' && (
                                            <section>
                                                <SectionHeader icon={Utensils} title="Nutritional Information" color="#34d399" />
                                                <div
                                                    style={{
                                                        background: 'rgba(15,23,42,0.4)',
                                                        border: '1px solid rgba(51,65,85,0.3)',
                                                        borderRadius: '8px',
                                                        padding: '12px 14px',
                                                        fontSize: '12px',
                                                        color: '#94a3b8',
                                                        lineHeight: '1.7',
                                                    }}
                                                >
                                                    {detail.nutritional_info}
                                                </div>
                                            </section>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailModal;
