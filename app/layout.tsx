import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/app/components/BottomNav'
import Sidebar from '@/app/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'YoungLife RI CRM',
  description: 'Relationship management for YoungLife Rhode Island',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch user profile for sidebar
  let userProfile = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('name, role')
      .eq('id', user.id)
      .single()
    userProfile = data
  }

  const isLoggedIn = !!user

  return (
    <html lang="en">
      <body className={inter.className}>
        {isLoggedIn ? (
          <div className="flex min-h-screen">
            {/* Desktop sidebar */}
            <Sidebar userName={userProfile?.name ?? user?.email ?? ''} userRole={userProfile?.role ?? 'member'} />

            {/* Main content */}
            <main className="flex-1 md:ml-56 pb-16 md:pb-0">
              <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
            </main>

            {/* Mobile bottom nav */}
            <BottomNav />
          </div>
        ) : (
          <main className="min-h-screen">{children}</main>
        )}
      </body>
    </html>
  )
}
