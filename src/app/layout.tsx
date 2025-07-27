import type { Metadata } from 'next';
import { ReactNode } from 'react';
import ClientWrapper from '../components/ClientWrapper';
import './globals.css';

export const metadata: Metadata = {
  title: 'Neon Maze Game',
  description: '3D Neon Maze game controlled by phone',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}