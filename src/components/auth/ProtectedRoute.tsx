import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import {
  requiresMfaChallenge,
  toVerifiedFactorSummaries
} from '@/lib/auth/mfaPolicy';
import type { MfaFactorSummary } from '@/lib/auth/mfaPolicy';

import MfaOtpForm from './MfaOtpForm';

interface ProtectedRouteProps {
  children: ReactNode;
}

type AuthGateState =
  | { status: 'checking' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated' }
  | { status: 'mfa-required'; factors: MfaFactorSummary[] }
  | { status: 'error'; message: string };

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [gate, setGate] = useState<AuthGateState>({ status: 'checking' });
  const location = useLocation();

  const checkAuth = useCallback(async () => {
    setGate({ status: 'checking' });

    try {
      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        setGate({ status: 'unauthenticated' });
        return;
      }

      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;

      if (requiresMfaChallenge(aal?.currentLevel, aal?.nextLevel)) {
        const { data: factorData, error: factorError } =
          await supabase.auth.mfa.listFactors();

        if (factorError) throw factorError;

        const factors = toVerifiedFactorSummaries(factorData?.all);

        if (factors.length === 0) {
          setGate({
            status: 'error',
            message:
              'A second authentication factor is required, but no verified factor is available.'
          });
          return;
        }

        setGate({ status: 'mfa-required', factors });
        return;
      }

      setGate({ status: 'authenticated' });
    } catch (error: unknown) {
      console.error('Authentication gate failed:', error);
      setGate({
        status: 'error',
        message: errorMessage(error, 'Unable to verify your authentication level.')
      });
    }
  }, []);

  useEffect(() => {
    void checkAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      // Supabase recommends deferring additional auth calls made in this
      // callback so they do not contend with the auth client's internal lock.
      window.setTimeout(() => {
        void checkAuth();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [checkAuth]);

  if (gate.status === 'checking') {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (gate.status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (gate.status === 'mfa-required') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-gray-900">
            Two-factor authentication
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verify a second factor before continuing to ShopOpti.
          </p>
          <div className="mt-6">
            <MfaOtpForm factors={gate.factors} onVerified={checkAuth} />
          </div>
        </div>
      </div>
    );
  }

  if (gate.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-semibold text-gray-900">
            Authentication verification failed
          </h1>
          <p className="mt-2 text-sm text-red-600" role="alert">
            {gate.message}
          </p>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-primary"
            onClick={() => void checkAuth()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
