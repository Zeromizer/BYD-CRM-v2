import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore, useProfile, useTodoStore } from '@/stores';
import {
  Menu,
  X,
  Home,
  FileText,
  FileSpreadsheet,
  CheckSquare,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import './Layout.css';

interface HeaderProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const profile = useProfile();
  const signOut = useAuthStore((state) => state.signOut);
  const toggleTodoSidebar = useTodoStore((state) => state.toggleSidebar);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/excel', label: 'Excel', icon: FileSpreadsheet },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="header-logo">
          <span className="logo-text">BYD CRM</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="header-nav desktop-only">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="header-actions">
          {/* Todo Toggle */}
          <button
            onClick={toggleTodoSidebar}
            className="header-icon-button"
            title="Toggle Tasks"
          >
            <CheckSquare size={20} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="header-icon-button"
            title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* User Menu */}
          <div className="user-menu-container">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="user-menu-trigger"
            >
              <div className="user-avatar">
                {profile?.display_name?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="user-name desktop-only">
                {profile?.display_name || 'User'}
              </span>
            </button>

            {userMenuOpen && (
              <>
                <div className="menu-overlay" onClick={() => setUserMenuOpen(false)} />
                <div className="user-menu">
                  <div className="user-menu-header">
                    <p className="user-menu-name">{profile?.display_name || 'User'}</p>
                    <p className="user-menu-email">{profile?.email}</p>
                  </div>
                  <div className="user-menu-divider" />
                  <button onClick={handleSignOut} className="user-menu-item danger">
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="header-icon-button mobile-only"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="mobile-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
