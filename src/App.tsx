import React from 'react';
import { CrmProvider, useCrm } from './store/CrmContext';
import { Shell } from './components/Shell';
import { Modals } from './components/Modals';
import { Drawers } from './components/Drawers';
import { Toasts } from './components/Toasts';
import { AuthViews } from './components/AuthViews';
import { SwapView } from './components/Motion';
import { OverviewPage } from './components/pages/OverviewPage';
import { PipelinePage } from './components/pages/PipelinePage';
import { ContactsPage } from './components/pages/ContactsPage';
import { ActivitiesPage } from './components/pages/ActivitiesPage';
import { QuotesPage } from './components/pages/QuotesPage';
import { TeamPage } from './components/pages/TeamPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { HelpPage } from './components/pages/HelpPage';

const AppContent: React.FC = () => {
  const { state, space, route, navDir } = useCrm();

  if (!state.signedIn) {
    return (
      <>
        <AuthViews />
        <Toasts />
      </>
    );
  }

  return (
    <>
      <Shell>
        <SwapView swapKey={`${space.id}-${route.page}`} direction={navDir} isPageSwap>
          {route.page === 'overview' && <OverviewPage />}
          {route.page === 'pipeline' && <PipelinePage />}
          {route.page === 'contacts' && <ContactsPage />}
          {route.page === 'activities' && <ActivitiesPage />}
          {route.page === 'quotes' && <QuotesPage />}
          {route.page === 'team' && <TeamPage />}
          {route.page === 'reports' && <ReportsPage />}
          {route.page === 'settings' && <SettingsPage />}
          {route.page === 'help' && <HelpPage />}
        </SwapView>
      </Shell>
      <Drawers />
      <Modals />
      <Toasts />
    </>
  );
};

export const App: React.FC = () => (
  <CrmProvider>
    <AppContent />
  </CrmProvider>
);

export default App;
