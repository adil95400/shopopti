import React from 'react';
import { Check } from 'lucide-react';

import CheckoutButton from './CheckoutButton';
import type { BillingCycle } from '@/lib/stripe';

interface PricingCardProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  plan: string | null;
  billingCycle?: BillingCycle;
  current?: boolean;
  popular?: boolean;
  buttonText?: string;
}

const PricingCard: React.FC<PricingCardProps> = ({
  title,
  price,
  description,
  features,
  plan,
  billingCycle = 'monthly',
  current = false,
  popular = false,
  buttonText = 'S’abonner'
}) => {
  return (
    <div className={`rounded-lg border ${popular ? 'border-primary-400 shadow-lg' : 'border-gray-200'} bg-white p-6 shadow-sm transition-all hover:shadow-md`}>
      {popular && (
        <div className="mb-4">
          <span className="inline-block rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-600">
            Populaire
          </span>
        </div>
      )}

      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-4 text-3xl font-bold">{price}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start">
            <Check className="mr-2 h-5 w-5 flex-shrink-0 text-green-500" />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {plan && !current ? (
          <CheckoutButton
            plan={plan}
            billingCycle={billingCycle}
            className={`w-full ${popular ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-gray-800 text-white hover:bg-gray-900'}`}
          >
            {buttonText}
          </CheckoutButton>
        ) : (
          <button
            type="button"
            className="w-full rounded-md bg-gray-100 px-4 py-2 text-gray-800"
            disabled
          >
            {current ? 'Plan actuel' : 'Gratuit'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PricingCard;
