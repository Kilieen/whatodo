import './globals.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Whatodo — Task & team coordination',
  description: 'Whatodo · Coordination de projets, tâches et équipes. Simple, moderne, élégant.',
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a1628',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Whatodo" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="min-h-screen text-foreground antialiased overflow-x-hidden">
        <div className="noise-overlay" />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
