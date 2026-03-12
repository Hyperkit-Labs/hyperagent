'use client';

import { create } from 'zustand';

interface WorkspaceState {
  activeWorkspaceId: string;
  setActiveWorkspace: (id: string) => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  activeWorkspaceId: 'default',
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
}));
