import React from 'react';
import { Toaster as SonnerToaster, ToasterProps } from 'sonner';

export function Toaster(props: ToasterProps) {
  return <SonnerToaster position="top-right" richColors expand {...props} />;
}
