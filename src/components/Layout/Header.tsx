import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { House, File, FileXls, CheckSquare, Moon, Sun, Snowflake, SignOut, X, List } from '@phosphor-icons/react';
import { useAuthStore, useProfile, useTodoStore } from '@/stores';
import './Layout.css';

const NAV_ICONS = {
  '/': House,
  '/documents': File,
  '/excel': FileXls,
};

type Theme = 'light' | 'dark' | 'cool';

interface HeaderProps {
  theme: Theme;
  onCycleTheme: () => void;
  onSetTheme: (theme: Theme) => void;
}

const THEME_CONFIG = {
  light: { icon: Sun, label: 'Light', next: 'Dark Mode' },
  dark: { icon: Moon, label: 'Dark', next: 'Cool Mode' },
  cool: { icon: Snowflake, label: 'Cool', next: 'Light Mode' },
} as const;

export function Header({ theme, onCycleTheme, onSetTheme }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const location = useLocation();
  const profile = useProfile();
  const signOut = useAuthStore((state) => state.signOut);
  const toggleTodoSidebar = useTodoStore((state) => state.toggleSidebar);

  const navItems = [
    { path: '/' as const, label: 'Dashboard' },
    { path: '/documents' as const, label: 'Documents' },
    { path: '/excel' as const, label: 'Excel' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  const ThemeIcon = THEME_CONFIG[theme].icon;

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
        <Link to="/" className="header-logo">
          <span className="logo-text">BYD CRM</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="header-nav desktop-only">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.path];
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                <Icon size={18} className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
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

          {/* Theme Selector */}
          <div className="theme-menu-container">
            <button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              className="header-icon-button"
              title={`Current: ${THEME_CONFIG[theme].label} - Click to change`}
            >
              <ThemeIcon size={20} />
            </button>

            {themeMenuOpen && (
              <>
                <div className="menu-overlay" onClick={() => setThemeMenuOpen(false)} />
                <div className="theme-menu">
                  <div className="theme-menu-title">Theme</div>
                  {(Object.keys(THEME_CONFIG) as Theme[]).map((t) => {
                    const config = THEME_CONFIG[t];
                    const Icon = config.icon;
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          onSetTheme(t);
                          setThemeMenuOpen(false);
                        }}
                        className={`theme-menu-item ${theme === t ? 'active' : ''}`}
                      >
                        <Icon size={18} />
                        <span>{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

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
                    <SignOut size={18} className="menu-icon" />
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
            {mobileMenuOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav className="mobile-nav">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.path];
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={18} className="nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
