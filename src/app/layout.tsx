import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nference Research OS',
  description: 'Secure study and cohort operations platform for clinical research teams.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
