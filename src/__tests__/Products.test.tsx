import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockProducts = [
  { id: 1, title: 'TV', description: 'desc', price: 100, image_url: '', category: 'Electronics' },
  { id: 2, title: 'Shirt', description: 'desc', price: 20, image_url: '', category: 'Clothing' }
];

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: jest.fn().mockResolvedValue({ data: mockProducts })
    })
  }
}));

jest.mock('../services/aiService', () => ({
  aiService: {
    optimizeProduct: jest.fn(),
    optimizeProductTitle: jest.fn()
  }
}));

import Products from '../pages/Products';

describe('Products', () => {
  it('renders products and filters by category', async () => {
    render(
      <MemoryRouter>
        <Products />
      </MemoryRouter>
    );

    expect(await screen.findByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Shirt')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Filtrer par catégorie/i), {
      target: { value: 'clo' }
    });

    await waitFor(() => {
      expect(screen.getByText('Shirt')).toBeInTheDocument();
    });
    expect(screen.queryByText('TV')).toBeNull();
  });
});
