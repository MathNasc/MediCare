import React from 'react';

export function BrDateInput({ value, onChange, style, placeholder = 'DD/MM/AAAA', ...props }) {
  const format = (v) => {
    if (!v) return '';
    const parts = v.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return v;
  };

  const displayValue = format(value);
  
  // Extract box-model styles for wrapper vs internal input
  const { 
    padding, paddingLeft, paddingRight, paddingTop, paddingBottom, 
    ...wrapperStyle 
  } = style || {};

  const inputPadding = padding || '12px 14px';

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', overflow: 'hidden', ...wrapperStyle }}>
      <span style={{ 
        position: 'absolute', 
        left: 14, // Hardcoded for most inputs in this app
        pointerEvents: 'none', 
        color: displayValue ? (style?.color || 'inherit') : 'rgba(150, 150, 150, 0.7)',
        zIndex: 1,
        fontSize: style?.fontSize || 'inherit',
      }}>
        {displayValue || placeholder}
      </span>
      <input
        type="date"
        className="br-date-input"
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          padding: inputPadding,
          color: 'transparent', 
          position: 'relative',
          zIndex: 2,
          fontFamily: 'inherit',
          fontSize: style?.fontSize || 'inherit',
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none'
        }}
        {...props}
      />
    </div>
  );
}
