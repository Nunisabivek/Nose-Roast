
import React, { forwardRef } from 'react';
import { Trophy, Zap } from 'lucide-react';

interface RoastCardProps {
    score: number;
    highScore: number;
    roast: string;
    username?: string;
}

const RoastCard = forwardRef<HTMLDivElement, RoastCardProps>(({ score, highScore, roast, username }, ref) => {
    const isNewRecord = score >= highScore && score > 0;
    const scoreLevel = score <= 2 ? 'rookie' : score <= 7 ? 'rising' : score <= 15 ? 'skilled' : 'legend';

    const levelConfig = {
        rookie: { emoji: '🐣', label: 'ROOKIE', gradient: 'from-cyan-500 to-blue-500' },
        rising: { emoji: '⚡', label: 'RISING STAR', gradient: 'from-purple-500 to-pink-500' },
        skilled: { emoji: '🔥', label: 'ON FIRE', gradient: 'from-orange-500 to-red-500' },
        legend: { emoji: '👑', label: 'LEGENDARY', gradient: 'from-yellow-400 to-orange-500' },
    };

    const config = levelConfig[scoreLevel];
    const displayName = username?.trim() || 'Player';

    return (
        <div
            ref={ref}
            style={{
                width: '320px',
                background: 'linear-gradient(180deg, rgba(20, 28, 48, 0.98) 0%, rgba(10, 15, 30, 0.99) 100%)',
                borderRadius: '28px',
                overflow: 'hidden',
                fontFamily: 'Inter, sans-serif',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: `0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px ${scoreLevel === 'legend' ? 'rgba(234, 179, 8, 0.12)' : scoreLevel === 'skilled' ? 'rgba(249, 115, 22, 0.12)' : scoreLevel === 'rising' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(6, 182, 212, 0.12)'}`,
            }}
        >
            {/* Top Gradient Bar */}
            <div
                style={{
                    height: '6px',
                    background: `linear-gradient(90deg, ${scoreLevel === 'legend' ? '#facc15, #f97316' : scoreLevel === 'skilled' ? '#f97316, #ef4444' : scoreLevel === 'rising' ? '#a855f7, #ec4899' : '#06b6d4, #3b82f6'})`,
                }}
            />

            <div style={{ padding: '24px' }}>
                {/* Player Info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: '12px',
                        border: '1.5px solid rgba(255,255,255,0.1)'
                    }}>
                        <span style={{ fontSize: '20px' }}>👤</span>
                    </div>
                    <div>
                        <p style={{
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: 'bold',
                            margin: '0 0 4px 0',
                            letterSpacing: '-0.3px'
                        }}>{displayName}</p>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: `linear-gradient(90deg, ${scoreLevel === 'legend' ? '#facc15, #f97316' : scoreLevel === 'skilled' ? '#f97316, #ef4444' : scoreLevel === 'rising' ? '#a855f7, #ec4899' : '#06b6d4, #3b82f6'})`,
                        }}>
                            <span style={{ fontSize: '12px' }}>{config.emoji}</span>
                            <span style={{ color: 'white', fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' }}>{config.label}</span>
                        </div>
                    </div>
                </div>

                {/* Score Card */}
                <div style={{
                    background: 'rgba(5, 8, 16, 0.8)',
                    borderRadius: '20px',
                    padding: '24px',
                    textAlign: 'center',
                    marginBottom: '16px',
                    position: 'relative',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.4)'
                }}>
                    {isNewRecord && (
                        <div style={{
                            position: 'absolute',
                            top: '-12px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'linear-gradient(90deg, #facc15, #f97316)',
                            color: '#0f172a',
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '5px 12px',
                            borderRadius: '20px',
                            boxShadow: '0 4px 12px rgba(249, 115, 22, 0.3)'
                        }}>
                            <Trophy size={12} /> NEW RECORD!
                        </div>
                    )}
                    <p style={{
                        fontSize: '72px',
                        fontWeight: '900',
                        color: 'white',
                        margin: '0',
                        lineHeight: '1',
                        fontFamily: "'Fredoka One', cursive, sans-serif"
                    }}>{score}</p>
                    <p style={{
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: '11px',
                        fontWeight: '800',
                        letterSpacing: '3px',
                        margin: '8px 0 0 0'
                    }}>POINTS</p>
                </div>

                {/* Roast Quote */}
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    marginBottom: '16px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)'
                }}>
                    <p style={{
                        color: 'white',
                        fontSize: '14px',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        margin: '0',
                        lineHeight: '1.5',
                        fontWeight: '500'
                    }}>
                        "{roast}"
                    </p>
                </div>

                {/* Best Score */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginBottom: '16px'
                }}>
                    <Zap size={16} color="#34d399" />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                        Best Score: <span style={{ color: '#34d399', fontWeight: 'bold' }}>{highScore}</span>
                    </span>
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #f97316, #ef4444)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <span style={{ fontSize: '14px' }}>👃</span>
                        </div>
                        <div>
                            <p style={{ color: 'white', fontSize: '11px', fontWeight: 'bold', margin: '0' }}>NOSEROAST</p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', margin: '0' }}>Fly with your face</p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#f97316', fontSize: '11px', fontWeight: 'bold', margin: '0' }}>#GetRoasted</p>
                        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '9px', margin: '0' }}>Play on Android</p>
                    </div>
                </div>
            </div>
        </div>
    );
});

RoastCard.displayName = 'RoastCard';

export default RoastCard;
