/**
 * State Controller
 * Manages platform state aggregation, in-memory caching, and PostgreSQL RPC invocation.
 */
import { supabaseRequest, getRows } from '../database/supabaseClient.mjs';

const toCamel = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), value]));

const stateCache = new Map();

export function clearStateCache() {
  stateCache.clear();
}

export async function getStateFor({ token, userId, definitions, appIds }) {
  const cached = stateCache.get(userId);
  if (cached && Date.now() - cached.ts < 2500) return cached.state;

  let raw = null;
  try {
    raw = await supabaseRequest('/rest/v1/rpc/get_platform_state', { token, method: 'POST' });
  } catch {
    raw = null;
  }

  let result;
  if (raw && raw.organizationId) {
    const moduleRows = raw.moduleRows || [];
    const modules = Object.fromEntries(definitions.map(def => {
      const row = moduleRows.find(item => item.app_id === def.id);
      return [def.id, {
        status: row?.status || 'active',
        updatedAt: row?.updated_at || '',
        deploymentMode: 'supabase',
        workerName: '',
        repositoryPath: '',
        deploymentUrl: `/apps/${def.id}`,
        deploymentStatus: 'local'
      }];
    }));
    result = {
      organizationId: raw.organizationId,
      modules,
      contacts: (raw.contacts || []).map(toCamel),
      products: (raw.products || []).map(toCamel),
      orders: (raw.orders || []).map(toCamel),
      tasks: (raw.tasks || []).map(toCamel),
      integrationContracts: raw.contractRows || [],
      audit: (raw.auditRows || []).map(row => ({
        id: String(row.id),
        action: row.action,
        moduleId: row.app_id,
        details: typeof row.details === 'object' ? JSON.stringify(row.details) : String(row.details || ''),
        at: row.created_at
      }))
    };
  } else {
    const memberships = await supabaseRequest(`/rest/v1/app_memberships?select=organization_id&user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&limit=1`, { token });
    if (!memberships?.length) throw Object.assign(new Error('Your account has no app access yet. Ask the platform admin to assign access.'), { status: 403 });
    const orgId = memberships[0].organization_id;
    const [moduleRows, auditRows, contractRows] = await Promise.all([
      getRows('app_registry', orgId, token, '&order=app_id'),
      supabaseRequest(`/rest/v1/audit_log?select=*&organization_id=eq.${encodeURIComponent(orgId)}&order=created_at.desc&limit=100`, { token }),
      supabaseRequest('/rest/v1/integration_contracts?select=*&status=eq.active&order=producer_app,consumer_app', { token })
    ]);
    const appRows = Object.fromEntries(await Promise.all(appIds.map(async appId => {
      const moduleStatus = moduleRows.find(row => row.app_id === appId)?.status;
      return [appId, moduleStatus === 'removed' ? [] : await getRows(appId, orgId, token, '&order=created_at.asc', appId)];
    })));
    const modules = Object.fromEntries(definitions.map(def => {
      const row = moduleRows.find(item => item.app_id === def.id);
      return [def.id, {
        status: row?.status || 'active',
        updatedAt: row?.updated_at || '',
        deploymentMode: 'supabase',
        workerName: '',
        repositoryPath: '',
        deploymentUrl: `/apps/${def.id}`,
        deploymentStatus: 'local'
      }];
    }));
    result = {
      organizationId: orgId,
      modules,
      contacts: appRows.contacts.map(toCamel),
      products: appRows.products.map(toCamel),
      orders: appRows.orders.map(toCamel),
      tasks: appRows.tasks.map(toCamel),
      integrationContracts: contractRows,
      audit: auditRows.map(row => ({
        id: String(row.id),
        action: row.action,
        moduleId: row.app_id,
        details: JSON.stringify(row.details),
        at: row.created_at
      }))
    };
  }

  stateCache.set(userId, { state: result, ts: Date.now() });
  return result;
}
