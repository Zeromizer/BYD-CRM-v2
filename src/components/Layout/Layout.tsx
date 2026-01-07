import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TodoSidebar } from './TodoSidebar';
import { useTheme } from '@/context/ThemeContext';
import './Layout.css';

export function Layout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="layout">
      <Header theme={theme} onSetTheme={setTheme} />
      <main className="main-content">
        <Outlet />
      </main>
      <TodoSidebar />
    </div>
  );
}
