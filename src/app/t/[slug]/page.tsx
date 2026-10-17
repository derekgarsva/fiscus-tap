import PaymentClient from './PaymentClient';

export function generateStaticParams() {
  return [
    { slug: 'sharky' },
    { slug: 'cafeteria-central' },
    { slug: 'demo' },
  ];
}

export default function PaymentPage({ params }: { params: { slug: string } }) {
  return <PaymentClient slug={params.slug} />;
}
