/**
 * User-owned templates: DB index + IPFS CID (orchestrator /api/v1/user-templates).
 */

import {
  ApiPaths,
  artifactFetchPath,
  artifactPath,
  userTemplatePath,
  userTemplateVersionsPath,
} from "@hyperagent/api-contracts";
import { fetchJsonAuthed, type FetchJsonOptions } from "./core";

export interface UserTemplateRow {
  id: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  status?: string;
  current_version_id?: string | null;
  wallet_user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserTemplateVersionSummary {
  id?: string;
  version_number?: number;
  cid?: string | null;
  pin_status?: string;
  content_hash?: string;
  gateway_url?: string | null;
}

export interface UserTemplateSummaryResponse {
  id: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  status?: string;
  current_version?: UserTemplateVersionSummary | null;
  updated_at?: string;
}

export interface PublishTemplateVersionResponse {
  version_id: string;
  template_id: string;
  version_number: number;
  cid: string;
  ipfs_url: string;
  content_hash: string;
  pin_status: string;
}

export async function listUserTemplates(
  signal?: AbortSignal,
): Promise<{ templates: UserTemplateRow[]; total: number }> {
  return fetchJsonAuthed(
    ApiPaths.userTemplates,
    signal ? { signal } : undefined,
  );
}

export async function createUserTemplate(body: {
  name: string;
  description?: string;
  category?: string;
  project_id?: string;
}): Promise<{ id: string; status: string }> {
  return fetchJsonAuthed(ApiPaths.userTemplates, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function publishTemplateVersion(
  templateId: string,
  content: Record<string, unknown>,
  options?: FetchJsonOptions,
): Promise<PublishTemplateVersionResponse> {
  return fetchJsonAuthed(userTemplateVersionsPath(templateId), {
    method: "POST",
    body: JSON.stringify({ content }),
    ...options,
  });
}

export async function getUserTemplate(
  templateId: string,
): Promise<UserTemplateSummaryResponse> {
  return fetchJsonAuthed(userTemplatePath(templateId));
}

export async function lookupArtifactByCid(cid: string): Promise<{
  cid: string;
  template_id: string;
  version_id?: string;
  version_number?: number;
  content_hash?: string;
  pin_status?: string;
  gateway_url?: string | null;
}> {
  return fetchJsonAuthed(artifactPath(cid));
}

export async function fetchArtifactJson(
  cid: string,
  body?: { validate_hash?: string | null },
): Promise<{ cid: string; content: unknown }> {
  return fetchJsonAuthed(artifactFetchPath(cid), {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}
