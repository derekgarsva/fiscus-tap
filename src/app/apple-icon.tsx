import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
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
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            color: '#ffffff',
            fontSize: '92px',
            fontWeight: 800,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: '-4px',
          }}
        >
          <span>F</span>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: '#0071e3',
              marginLeft: '4px',
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
