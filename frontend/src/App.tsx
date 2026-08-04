import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from './services/api';
import { Login } from './pages/Login';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Chat } from './pages/Chat';
import { DocumentManagement } from './pages/DocumentManagement';
import { Dashboard } from './pages/Dashboard';
import { User } from './types';
import { Cpu } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [bootstrapping, setBootstrapping] = useState<boolean>(true);

  useEffect(() => {
    const initializeSession = async () => {
      if (token) {
        try {
          const profile = await api.auth.getMe();
          setUser(profile);
          if (profile.role !== 'admin' && activeTab === 'analytics') {
            setActiveTab('chat');
          }
        } catch (err) {
          handleLogout();
        }
      }
      setBootstrapping(false);
    };
    initializeSession();
  }, [token]);

  const handleLoginSuccess = (profile: User, accessToken: string) => {
    setToken(accessToken);
    setUser(profile);
    setActiveTab('chat');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveTab('chat');
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors">
        <div className="p-4 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-200 dark:shadow-none mb-4 animate-bounce">
          <Cpu size={32} />
        </div>
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">SupportAI Portal Initialization</h4>
        <p className="text-xs text-slate-400 mt-1">Establishing secure telemetry handshake with FastAPI database nodes...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <DashboardLayout
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={handleLogout}
    >
      {activeTab === 'chat' && <Chat />}
      {activeTab === 'documents' && <DocumentManagement user={user} />}
      {activeTab === 'analytics' && user.role === 'admin' && <Dashboard />}
    </DashboardLayout>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
