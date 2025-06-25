import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: jest.fn() }),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
    }
  }
}));

import Dashboard from '../pages/Dashboard';

jest.mock('../components/layout/MainNavbar', () => () => <div data-testid="navbar" />);
jest.mock('../components/layout/Footer', () => () => <div data-testid="footer" />);
jest.mock('../components/dashboard/SubscriptionOverview', () => () => <div data-testid="subscription-overview" />);
jest.mock('../components/tracking/TrackingWidget', () => () => <div data-testid="tracking-widget" />);

describe('Dashboard', () => {
  it('renders dashboard heading', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /Tableau de bord/i })).toBeInTheDocument();
  });
});
