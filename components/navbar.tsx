'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLoading } from './loading-provider'
import { useAiChat } from './ai-chat-context'
import { UserMenu } from './user-menu'
import { LayoutDashboard, FilePlus, ClipboardList, BarChart3 } from 'lucide-react'

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { setLoading } = useLoading()
  const { isOpen: aiChatOpen } = useAiChat()

  if (!session || !session.user) return null

  const userRole = session.user.role

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/reports/new', label: 'New Report', icon: FilePlus },
  ]

  if (['ADMIN', 'PM', 'EXECUTIVE'].includes(userRole)) {
    navItems.push(
      { href: '/reports/status', label: 'Report Status', icon: ClipboardList },
      { href: '/reports/weekly-summary', label: 'Weekly Summary', icon: BarChart3 }
    )
  }
  
  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    // Only trigger loading if navigating to a different page
    if (href !== pathname) {
      setLoading(true)
      // Use router.push for programmatic navigation to ensure loading shows
      e.preventDefault()
      router.push(href)
    }
  }

  return (
    <nav className="bg-gradient-to-r from-blue-600 via-blue-400 to-blue-200 shadow-lg dark:from-blue-900 dark:via-blue-800 dark:to-blue-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link 
              href="/" 
              className="text-xl font-bold text-white dark:text-white"
              onClick={(e) => handleLinkClick('/', e)}
            >
              Sabey Construction
            </Link>
            <div className="hidden space-x-4 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onClick={(e) => handleLinkClick(item.href, e)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                      pathname === item.href
                        ? 'bg-white/90 backdrop-blur-sm border border-white/50 text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300 dark:border-gray-600'
                        : 'text-white hover:bg-white/20 hover:backdrop-blur-sm hover:border hover:border-white/30 dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-8 h-8" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
          <div className={`flex items-center transition-opacity duration-300 ${aiChatOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}

