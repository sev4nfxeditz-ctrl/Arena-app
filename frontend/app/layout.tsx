import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Arena Pro — Online Multiplayer Gaming Platform',
  description: 'Play Chess, Checkers, and Tic Tac Toe online. Real-time multiplayer, AI opponents, ranked matches with ELO ratings, global leaderboards, and more.',
  keywords: ['chess', 'checkers', 'tic tac toe', 'multiplayer', 'online games', 'ranked', 'ELO'],
  authors: [{ name: 'Arena Pro' }],
  openGraph: {
    title: 'Arena Pro — Online Multiplayer Gaming',
    description: 'Play Chess, Checkers, and Tic Tac Toe online with friends or AI.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-arena-bg">
        {/* Grid background overlay */}
        <div className="fixed inset-0 grid-bg pointer-events-none z-0" />

        {/* App content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
