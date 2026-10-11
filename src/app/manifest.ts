import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Fiscus Tap – Pagos Físicos',
    short_name: 'Fiscus Tap',
    description: 'Infraestructura de cobro y pago físico a un toque para comercios y personas',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbfbfd',
    theme_color: '#fbfbfd',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
