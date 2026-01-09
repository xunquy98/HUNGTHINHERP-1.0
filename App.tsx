
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Partners from './pages/Partners';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Orders from './pages/Orders';
import Imports from './pages/Imports';
import Settings from './pages/Settings';
import Debts from './pages/Debts';
import Reports from './pages/Reports';
import Transactions from './pages/Transactions';
import Quotes from './pages/Quotes';
import DeliveryNotes from './pages/DeliveryNotes';
import SystemLogs from './pages/SystemLogs';
import { ViewState } from './types';
import { ToastCenter } from './components/ui/Toast';
import { useAppContext } from './contexts/AppContext';

// Helper to extract query params for legacy components
const LegacyWrapper = ({ Component, onNavigate }: { Component: React.FC<any>, onNavigate: (view: ViewState, params?: any) => void }) => {
    const [searchParams] = useSearchParams();
    
    const params = React.useMemo(() => {
        const p: any = {};
        if (searchParams.get('id')) p.highlightId = searchParams.get('id');
        return p;
    }, [searchParams]);

    return <Component onNavigate={onNavigate} initialParams={params} />;
};

const App = () => {
  const { toggleTheme, settings } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Determine current view for Sidebar highlighting
  const getCurrentView = (): ViewState => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'DASHBOARD';
    if (path.startsWith('/pos')) return 'POS';
    if (path.startsWith('/orders')) return 'ORDERS';
    if (path.startsWith('/quotes')) return 'QUOTES';
    if (path.startsWith('/deliveries')) return 'DELIVERY_NOTES';
    if (path.startsWith('/imports')) return 'IMPORTS';
    if (path.startsWith('/inventory')) return 'INVENTORY';
    if (path.startsWith('/partners')) return 'PARTNERS';
    if (path.startsWith('/debts')) return 'DEBTS';
    if (path.startsWith('/transactions')) return 'TRANSACTIONS';
    if (path.startsWith('/reports')) return 'REPORTS';
    if (path.startsWith('/logs')) return 'SYSTEM_LOGS';
    if (path.startsWith('/settings')) return 'SETTINGS';
    return 'DASHBOARD';
  };

  const currentView = getCurrentView();

  const handleNavigate = (view: ViewState, params?: any) => {
    let path = '/';
    const query = params?.highlightId ? `?id=${params.highlightId}` : '';
    
    switch (view) {
      case 'DASHBOARD': path = '/'; break;
      case 'POS': path = '/pos'; break;
      case 'ORDERS': path = params?.code ? `/orders/${params.code}` : `/orders${query}`; break;
      case 'QUOTES': path = params?.code ? `/quotes/${params.code}` : `/quotes${query}`; break;
      case 'DELIVERY_NOTES': path = params?.code ? `/deliveries/${params.code}` : `/deliveries${query}`; break;
      case 'IMPORTS': path = params?.code ? `/imports/${params.code}` : `/imports${query}`; break;
      case 'INVENTORY': path = `/inventory${query}`; break;
      case 'PARTNERS': path = `/partners${query}`; break;
      case 'DEBTS': path = `/debts${query}`; break;
      case 'TRANSACTIONS': path = `/transactions${query}`; break;
      case 'REPORTS': path = '/reports'; break;
      case 'SYSTEM_LOGS': path = '/logs'; break;
      case 'SETTINGS': path = '/settings'; break;
      default: path = '/';
    }
    
    navigate(path);
    setIsMobileMenuOpen(false); 
  };

  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 transition-colors duration-200 overflow-hidden relative font-sans">
      
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[60] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Fixed width for consistency */}
      <div className={`fixed inset-y-0 left-0 z-[70] lg:z-auto transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex-shrink-0 w-72 h-full ${isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <Sidebar currentView={currentView} onChangeView={(view) => handleNavigate(view)} />
      </div>
      
      {/* Main Content Area - Flex 1 and Min-W-0 to prevent flex child overflow */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative min-w-0">
        <Topbar 
          isDarkMode={settings.appearance.theme === 'dark'} 
          toggleTheme={toggleTheme} 
          onNavigate={handleNavigate} 
          currentView={currentView}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full bg-[#f8fafc] dark:bg-[#0b1121]">
          <Routes>
            <Route path="/" element={<Dashboard onNavigate={handleNavigate} />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            
            <Route path="/pos" element={<POS />} />
            
            {/* List Pages - These now manage their own internal scrolling via PageShell */}
            <Route path="/orders" element={<Orders onNavigate={handleNavigate} />} />
            <Route path="/orders/:code" element={<Orders onNavigate={handleNavigate} />} />
            
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/quotes/:code" element={<Quotes />} />
            
            <Route path="/imports" element={<Imports />} />
            <Route path="/imports/:code" element={<Imports />} />
            
            <Route path="/deliveries" element={<DeliveryNotes />} />
            <Route path="/deliveries/:code" element={<DeliveryNotes />} />

            <Route path="/inventory" element={<LegacyWrapper Component={Inventory} onNavigate={handleNavigate} />} />
            <Route path="/partners" element={<LegacyWrapper Component={Partners} onNavigate={handleNavigate} />} />
            <Route path="/debts" element={<Debts />} />
            <Route path="/transactions" element={<LegacyWrapper Component={Transactions} onNavigate={handleNavigate} />} />
            
            <Route path="/reports" element={<Reports onNavigate={handleNavigate} />} />
            <Route path="/logs" element={<SystemLogs />} />
            <Route path="/settings" element={<Settings />} />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      
      {/* Centralized Toast Notifications */}
      <ToastCenter />
    </div>
  );
};

export default App;
