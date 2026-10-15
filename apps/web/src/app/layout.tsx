import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EarnChat — Good conversations pay off',
  description:
    'Chat with real people and earn in KSh. Verify with M-Pesa, choose a plan, and get paid for eligible 5-minute chats.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
