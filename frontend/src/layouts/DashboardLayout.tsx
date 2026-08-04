import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, FileText, BarChart3, LogOut, Sun, Moon, Shield, Menu, X, User as UserIcon
} from 'lucide-react';
import { User } from '../types';

interface DashboardLayoutProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  children
}) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const navigationItems = [
    { id: 'chat', name: 'AI Chat Assistant', icon: MessageSquare, roles: ['user', 'admin'] },
    { id: 'documents', name: 'Knowledge Base', icon: FileText, roles: ['user', 'admin'] },
    { id: 'analytics', name: 'Admin Dashboard', icon: BarChart3, roles: ['admin'] },
  ];

  const visibleNavItems = navigationItems.filter(item => item.roles.includes(user.role));

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* Mobile Top Header Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 bg-indigo-600 rounded-lg text-white font-bold text-lg">🤖</span>
          <span className="font-bold tracking-tight text-slate-800 dark:text-slate-100 text-base">SupportAI</span>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Sidebar - Desktop and Mobile overlay */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm
        flex flex-col transform md:transform-none transition-transform duration-250 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        md:relative md:flex
      `}>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-indigo-600 rounded-xl text-white font-extrabold text-xl shadow-md shadow-indigo-200 dark:shadow-none">🤖</span>
            <div>
              <h1 className="font-extrabold text-slate-900 dark:text-white leading-tight">SupportAI</h1>
              <span className="text-xs text-slate-400 font-medium">Customer Assistant</span>
            </div>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 p-4 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'}
                `}
              >
                <Icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                <span>{item.name}</span>
                {item.id === 'analytics' && (
                  <span className="ml-auto text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center space-x-0.5">
                    <Shield size={10} />
                    <span>Admin</span>
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* bottom Active User section */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <UserIcon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {user.username}
              </p>
              <p className="text-xs text-slate-400 capitalize truncate flex items-center">
                {user.role === 'admin' ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center space-x-1">
                    <Shield size={11} className="mr-0.5" /> Admin
                  </span>
                ) : (
                  'Customer Support User'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:text-red-400 dark:hover:border-red-900/30 font-medium text-xs transition-all"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content pane */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar desktop-only */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm min-h-[70px]">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white capitalize">
              {navigationItems.find(n => n.id === activeTab)?.name || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Content Box */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* Mobile background overlay */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}
    </div>
  );
};
export default DashboardLayout;
