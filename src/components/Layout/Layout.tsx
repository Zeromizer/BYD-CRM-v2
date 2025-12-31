import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TodoSidebar } from './TodoSidebar';
import { useTheme } from '@/context/ThemeContext';
import './Layout.css';

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="layout">
      <Header theme={theme} onToggleTheme={toggleTheme} />
      <main className="main-content">
        <Outlet />
      </main>
      <TodoSidebar />
    </div>
  );
}
