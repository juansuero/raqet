import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://github.com/juansuero/raqet'),
  title: {
    default: 'Raqet - Smart Tennis Journal',
    template: '%s - Raqet',
  },
  description: 'Self-hostable solo tennis journal. Log sessions, voice debriefs, opponents, ratings, tournaments, and approved player memories.',
  openGraph: {
    title: 'Raqet - Smart Tennis Journal',
    description: 'A private tennis journal that remembers how your game evolves.',
    url: '/',
    siteName: 'Raqet',
    images: [
      {
        url: '/brand/raqet-hero-grass-court-painted-v3.webp',
        width: 1600,
        height: 900,
        alt: 'Painted grass tennis court for Raqet',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Raqet - Smart Tennis Journal',
    description: 'A private tennis journal that remembers how your game evolves.',
    images: ['/brand/raqet-hero-grass-court-painted-v3.webp'],
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
