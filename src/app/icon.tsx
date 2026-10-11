import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1d1d1f',
          borderRadius: '115px',
          border: '4px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            color: '#ffffff',
            fontSize: '240px',
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-12px',
          }}
        >
          <span>F</span>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#0071e3',
              marginLeft: '8px',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
