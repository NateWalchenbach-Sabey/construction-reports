'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/lib/constants'
import { LogOut, Settings, Moon, Sun, Building2, User, ChevronDown, DollarSign } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLoading } from './loading-provider'

export function UserMenu() {
  const { data: session } = useSession()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { setLoading } = useLoading()

  // Avoid hydration mismatch with theme
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setMounted(true)
    }, 0)
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (!session || !session.user) return null

  const userRole = session.user.role
  const isAdmin = userRole === 'ADMIN'

  const handleSignOut = () => {
    setIsOpen(false)
    signOut({ callbackUrl: '/login' })
  }

  const handleProjectsClick = () => {
    setIsOpen(false)
    setLoading(true)
    router.push('/admin/projects')
  }

  const handleCostReportsClick = () => {
    setIsOpen(false)
    setLoading(true)
    router.push('/admin/cost-reports')
  }

  const handleSettingsClick = () => {
    setIsOpen(false)
    // TODO: Navigate to settings page when implemented
    console.log('Settings clicked')
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  // Don't render theme-dependent content until mounted
  const currentTheme = mounted ? theme : 'light'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/30 transition-all shadow-sm cursor-pointer"
      >
        <User className="w-4 h-4" />
        <span>{session.user?.name || session.user?.email}</span>
        <span className="text-xs text-blue-100">
          ({ROLE_LABELS[userRole] || userRole})
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50 dark:bg-gray-800 dark:ring-gray-700">
            <div className="py-1" role="menu">
              {/* User Info */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {session.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {session.user?.email}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {ROLE_LABELS[userRole] || userRole}
                </p>
              </div>

              {/* Settings */}
              <button
                onClick={handleSettingsClick}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                role="menuitem"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>

              {/* Cost Reports (Admin only) */}
              {isAdmin && (
                <button
                  onClick={handleCostReportsClick}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Cost Reports</span>
                </button>
              )}

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                role="menuitem"
              >
                {currentTheme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4" />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4" />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>

              {/* Projects (Admin only) */}
              {isAdmin && (
                <button
                  onClick={handleProjectsClick}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Projects</span>
                </button>
              )}

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors cursor-pointer"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

