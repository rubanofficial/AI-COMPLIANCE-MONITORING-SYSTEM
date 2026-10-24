import React from 'react';

const SkeletonCard = ({ height, rows = 3 }) => {
    return (
        <div style={{
            background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(16px)',
            border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px',
            padding: '20px 24px',
            height: height ? `${height}px` : 'auto',
        }}>
            <style>{`
        @keyframes shimmer {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>

            {/* Title placeholder */}
            <div style={{
                width: '40%', height: '18px', borderRadius: '6px',
                background: 'rgba(51,65,85,0.5)', marginBottom: '24px',
                animation: 'shimmer 1.5s ease-in-out infinite',
            }} />

            {/* Content rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    <div style={{
                        height: '14px', borderRadius: '4px',
                        background: 'rgba(51,65,85,0.4)',
                        width: `${75 + (i % 3) * 8}%`,
                        animation: 'shimmer 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.15}s`,
                    }} />
                    <div style={{
                        height: '12px', borderRadius: '4px',
                        background: 'rgba(51,65,85,0.25)',
                        width: `${55 + (i % 2) * 15}%`,
                        animation: 'shimmer 1.5s ease-in-out infinite',
                        animationDelay: `${i * 0.15 + 0.1}s`,
                    }} />
                </div>
            ))}

            {/* Big content placeholder */}
            <div style={{
                height: '120px', borderRadius: '8px',
                background: 'rgba(51,65,85,0.2)',
                animation: 'shimmer 1.5s ease-in-out infinite',
            }} />
        </div>
    );
};

export default SkeletonCard;
