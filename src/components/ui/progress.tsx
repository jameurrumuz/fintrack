
"use client"

import * as React from "react"

const SingleProgressBar = ({ value, target, label, activeColor }: { value: number; target: number; label: string; activeColor: string }) => {
    const val = parseFloat(value.toString()) || 0;
    const trgt = parseFloat(target.toString()) || 0;

    if (trgt <= 0) return null;

    const rawPercentage = (val / trgt) * 100;
    const displayPercentage = Math.min(rawPercentage, 100);
    
    return (
        <div style={{ width: '100%', minWidth: '160px', margin: '12px 0', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: '700' }}>
                <span style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{label}</span>
                <span style={{ color: '#0f172a' }}>{val.toLocaleString()} / {trgt.toLocaleString()} ({rawPercentage.toFixed(0)}%)</span>
            </div>
            <div style={{ height: '14px', width: '100%', backgroundColor: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)' }}>
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${displayPercentage}%`,
                        backgroundColor: activeColor,
                        borderRadius: '8px',
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent)',
                        backgroundSize: '1rem 1rem'
                    }}
                />
            </div>
        </div>
    );
};

interface CustomProgressProps {
  value?: number;
  monthlyTarget?: number;
  programmeTarget?: number;
  className?: string;
}

export const Progress: React.FC<CustomProgressProps> = ({ value = 0, monthlyTarget, programmeTarget, className = "" }) => {
    const hasMonthly = monthlyTarget !== undefined && monthlyTarget > 0;
    const hasProgramme = programmeTarget !== undefined && programmeTarget > 0;

    if (hasMonthly || hasProgramme) {
      return (
        <div className={className} style={{ width: '100%' }}>
          {hasMonthly && <SingleProgressBar value={value} target={monthlyTarget} label="Monthly Target" activeColor="#10b981" />} {/* Emerald 500 */}
          {hasProgramme && <SingleProgressBar value={value} target={programmeTarget} label="Programme Target" activeColor="#0ea5e9" />} {/* Sky 500 */}
        </div>
      );
    }
  
    // Fallback for simple percentage bar
    const displayPercentage = Math.min(Math.max(value || 0, 0), 100);
    return (
        <div className={className} style={{ height: '8px', width: '100%', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
             <div
                style={{
                    height: '100%',
                    width: `${displayPercentage}%`,
                    backgroundColor: '#3b82f6',
                    transition: 'width 0.5s ease-in-out',
                }}
            />
        </div>
    );
};
