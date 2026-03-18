'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Account from thirdweb useActiveAccount - typed loosely for cross-package compatibility */
type ActiveAccount = { address: string; [key: string]: unknown } | null | undefined;

const ActiveAccountContext = createContext<ActiveAccount | null>(null);

export function ActiveAccountProvider({
  account,
  children,
}: {
  account: ActiveAccount;
  children: ReactNode;
}) {
  return (
    <ActiveAccountContext.Provider value={account}>
      {children}
    </ActiveAccountContext.Provider>
  );
}

export function useActiveAccountFromContext(): ActiveAccount {
  const ctx = useContext(ActiveAccountContext);
  return ctx ?? undefined;
}
