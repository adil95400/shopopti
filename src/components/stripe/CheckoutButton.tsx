import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  createCheckoutSession,
  type BillingCycle
} from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

interface CheckoutButtonProps {
  plan: string;
  billingCycle?: BillingCycle;
  children: React.ReactNode;
  className?: string;
}

const CheckoutButton: React.FC<CheckoutButtonProps> = ({
  plan,
  billingCycle = 'monthly',
  children,
  className = ''
}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        toast.error('Vous devez être connecté pour vous abonner.');
        navigate('/login', { state: { from: window.location.pathname } });
        return;
      }

      const { url } = await createCheckoutSession(plan, billingCycle);
      window.location.assign(url);
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Impossible de démarrer le paiement Stripe.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckout}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 font-medium transition-colors ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Chargement...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default CheckoutButton;
