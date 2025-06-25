import { render, screen } from '@testing-library/react';
import Contact from '../Contact';

describe('Contact page', () => {
  it('renders page heading', () => {
    render(<Contact />);
    expect(
      screen.getByRole('heading', { level: 1, name: /contact/i })
    ).toBeInTheDocument();
  });
});
