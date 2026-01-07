import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { TodoSidebar } from './TodoSidebar';
import { useTheme } from '@/context/ThemeContext';
import './Layout.css';

export function Layout() {
  const { theme, cycleTheme, setTheme } = useTheme();

  return (
    <div className="layout">
      <Header theme={theme} onCycleTheme={cycleTheme} onSetTheme={setTheme} />
      <main className="main-content">
        <Outlet />
      </main>
      <TodoSidebar />
    </div>
  );
}
