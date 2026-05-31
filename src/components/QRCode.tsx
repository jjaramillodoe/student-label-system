'use client';

import { QRCodeSVG } from 'qrcode.react';
import { CSSProperties } from 'react';

interface QRCodeProps {
  value: string;
  /** Internal SVG resolution — higher = crisper if the browser rasterises before printing */
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
  className?: string;
  /** Optional CSS override for the wrapper div (use to set physical print size in `in`) */
  containerStyle?: CSSProperties;
}

export default function QRCode({ 
  value, 
  size = 200, 
  level = 'M',
  includeMargin = false,
  className = '',
  containerStyle,
}: QRCodeProps) {
  return (
    <div className={className} style={containerStyle}>
      <QRCodeSVG
        value={value}
        size={size}
        level={level}
        includeMargin={includeMargin}
        /* fill the container so CSS inches control the physical print size */
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}

