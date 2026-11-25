import React from 'react';
import { AppProvider, useApp } from './store/AppContext';
import { Shell } from './components/Shell';
import { Modals } from './components/Modals';
import { Drawers } from './components/Drawers';
import { Toasts } from './components/Toasts';
import { LoginPage } from './components/LoginPage';
import { PinLockView } from './components/PinLockView';
import { SwapView } from './components/Motion';
import { IconSylvaMark } from './components/Icons';
import { OverviewPage } from './components/pages/OverviewPage';
import { TasksPage } from './components/pages/TasksPage';
import { FinancePage } from './components/pages/FinancePage';
import { ModulesPage } from './components/pages/ModulesPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { assetUrl } from './utils/assets';

const AppContent: React.FC = () => {
  const { authUser, authReady, locked, route, navDir } = useApp();

  if (!authReady) {
    return (
      <>
        <div className="backdrop" aria-hidden="true">
          <img src={assetUrl('/images/backdrop.jpg')} alt="" className="backdrop__img" />
          <div className="backdrop__wash" />
        </div>

        <div className="signin-wrap">
          <div className="signin" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="brand" style={{ justifyContent: 'center' }}>
              <span className="brand__mark">
                <IconSylvaMark size={18} />
              </span>
              <span className="brand__name">
                Coby<span className="brand__tag">LIFE</span>
              </span>
            </div>
            <h1 className="signin__title">Coby LIFE</h1>
            <p className="signin__sub" style={{ marginBottom: 0 }}>
              Restoring your workspace...
            </p>
          </div>
        </div>
        <Toasts />
      </>
    );
  }

  if (!authUser) {
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
