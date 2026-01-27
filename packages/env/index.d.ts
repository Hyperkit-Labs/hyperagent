export type RootPredicate = (dir: string) => boolean;
export interface LoadRootEnvOptions {
  cwd?: string;
  override?: boolean;
  required?: boolean;
  envFileName?: string;
  rootPredicate?: RootPredicate;
}
export interface LoadRootEnvResult {
  loaded: boolean;
  rootDir: string | null;
  envPath: string | null;
  error: string | null;
}
export function loadRootEnv(opts?: LoadRootEnvOptions): LoadRootEnvResult;
