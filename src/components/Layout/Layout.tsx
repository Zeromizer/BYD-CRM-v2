import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { TodoSidebar } from './TodoSidebar'
import { useTheme } from '@/context/ThemeContext'
import { usePWABackHandler } from '@/hooks'
import './Layout.css'

export function Layout() {
  const { theme, setTheme } = useTheme()

  // Handle PWA back gesture on mobile
  usePWABackHandler()

  return (
    <div className="layout">
      <Header theme={theme} onSetTheme={setTheme} />
      <main className="main-content">
        <Outlet />
      </main>
      <TodoSidebar />
    </div>
  )
}
