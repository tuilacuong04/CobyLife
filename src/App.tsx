import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { Shell } from './components/Shell';
import { Modals } from './components/Modals';
import { Drawers } from './components/Drawers';
import { Toasts } from './components/Toasts';
import { LoginPage } from './components/LoginPage';
import { PinLockView } from './components/PinLockView';
import { SwapView } from './components/Motion';
import { OverviewPage } from './components/pages/OverviewPage';
import { TasksPage } from './components/pages/TasksPage';
import { FinancePage } from './components/pages/FinancePage';
import { ModulesPage } from './components/pages/ModulesPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { AUTH_CHANGE_EVENT, isAuthenticated } from './utils/auth';

const AppContent: React.FC = () => {
  const { locked, route, navDir } = useApp();
  const [authed, setAuthed] = useState<boolean>(() => isAuthenticated());

  useEffect(() => {
    const syncAuth = () => {
      setAuthed(isAuthenticated());
    };
    window.addEventListener(AUTH_CHANGE_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  if (!authed) {
    return (
      <>
        <LoginPage />
        <Toasts />
      </>
    );
  }

  if (locked) {
    return (
      <>
        <PinLockView />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Shell>
        <SwapView swapKey={route.page} direction={navDir} isPageSwap>
          {route.page === 'overview' && <OverviewPage />}
          {route.page === 'tasks' && <TasksPage />}
          {route.page === 'finance' && <FinancePage />}
          {route.page === 'modules' && <ModulesPage />}
          {route.page === 'settings' && <SettingsPage />}
        </SwapView>
      </Shell>
      <Drawers />
      <Modals />
      <Toasts />
    </>
  );
};

export const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;
