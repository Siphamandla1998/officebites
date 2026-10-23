// Operator only. Default is offline help; never run automatically from build/tests.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { PROJECT, RUN, ORIGIN, RELEASE, reconcile, validateCheckpoint, validateReleaseReference } from './provision-core.mjs';

function powershell(script, input = '') {
  const childEnv = { ...process.env };
  delete childEnv.STAGING_SUPABASE_ADMIN_KEY;
  delete childEnv.STAGING_SUPABASE_MANAGEMENT_TOKEN;
  const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input, encoding: 'utf8', windowsHide: true, env: childEnv });
  if (r.status !== 0 || r.error) throw Error('Local secure-store operation failed');
  return r.stdout.trim();
}
export function transform(value, encrypt) {
  return powershell(encrypt
    ? "$ErrorActionPreference='Stop'; $s=[Console]::In.ReadToEnd(); ConvertTo-SecureString -String $s -AsPlainText -Force | ConvertFrom-SecureString"
    : "$ErrorActionPreference='Stop'; $s=ConvertTo-SecureString ([Console]::In.ReadToEnd()); $p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }", value);
}
async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--execute') {
    console.log('Operator-only: read docs/vendor-direct-uat-security-local.md before using --execute. No network calls made.');
    return;
  }
  if (process.platform !== 'win32') throw Error('This credential vault requires Windows CurrentUser DPAPI');
  const key = process.env.STAGING_SUPABASE_ADMIN_KEY;
  const management = process.env.STAGING_SUPABASE_MANAGEMENT_TOKEN;
  if (!key || !management || !process.env.OFFICEBITES_UAT_CHECKPOINT) throw Error('Operator secret/checkpoint inputs required');
  const suppliedCheckpoint = JSON.parse(fs.readFileSync(process.env.OFFICEBITES_UAT_CHECKPOINT, 'utf8'));
  const checkpoint = Object.fromEntries(['project', 'run', 'migration', 'name', 'status', 'checkedAt',
    'notificationIsolationVerified', 'backendRestrictionVerified', 'authHooksReviewed', 'allPaymentsDisabled',
    'releaseCommit', 'preview', 'previewUrl', 'provisioningApproved']
    .map(name => [name, suppliedCheckpoint[name]]));
  validateCheckpoint(checkpoint);
  // Independent project identity read, before any creation request.
  const identityResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}`, {
    redirect: 'error', headers: { Authorization: `Bearer ${management}` }, signal: AbortSignal.timeout(15000),
  });
  if (!identityResponse.ok) throw Error('Cannot independently verify staging project');
  const identity = await identityResponse.json();
  if (identity.id !== PROJECT || identity.name !== 'officebites-staging' || identity.status !== 'ACTIVE_HEALTHY') throw Error('Project identity mismatch');
  const safeFetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input);
    if (url.origin !== ORIGIN || url.username || url.password) throw Error('Refusing non-staging request');
    return fetch(input, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
  };
  const client = createClient(ORIGIN, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: safeFetch } });
  const unwrap = r => { if (r.error) throw Error('Staging Admin API failed; inspect securely and reconcile before retry'); return r.data; };
  const gateways = unwrap(await client.rpc('get_payment_gateways'));
  const rows = Array.isArray(gateways) ? gateways : gateways?.gateways;
  if (!Array.isArray(rows) || rows.length !== 4 || rows.some(g => g.enabled)) throw Error('Expected all four methods disabled');

  const directory = path.resolve('.officebites-local', RUN);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.lstatSync(directory).isSymbolicLink() || fs.realpathSync(directory).toLowerCase() !== directory.toLowerCase()) throw Error('Refusing redirected fixture directory');
  process.env.OFFICEBITES_UAT_VAULT_DIR = directory;
  // Replace the ACL instead of merely adding a grant alongside unknown explicit grants.
  powershell("$ErrorActionPreference='Stop'; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object Security.AccessControl.DirectorySecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule); Set-Acl -LiteralPath $env:OFFICEBITES_UAT_VAULT_DIR -AclObject $acl");
  const lockPath = path.join(directory, 'provision.lock');
  const lock = fs.openSync(lockPath, 'wx');
  try {
    const vaultPath = path.join(directory, 'credentials.dpapi');
    const state = fs.existsSync(vaultPath) ? JSON.parse(transform(fs.readFileSync(vaultPath, 'utf8'), false))
      : { project: PROJECT, run: RUN, migration: '20261020100740', ...RELEASE, accounts: {}, meals: {}, paymentProfiles: {}, orders: [], checkpoint };
    validateReleaseReference(state); // Never silently relabel an existing encrypted manifest.
    const save = async value => {
      const encrypted = transform(JSON.stringify(value), true);
      const temporary = vaultPath + '.tmp';
      fs.writeFileSync(temporary, encrypted, { flag: 'wx' });
      fs.renameSync(temporary, vaultPath);
      const publicState = { ...value, accounts: Object.fromEntries(Object.entries(value.accounts).map(([name, account]) => {
        const { password: _password, ...nonsecret } = account;
        return [name, { ...nonsecret, credentialVault: 'credentials.dpapi' }];
      })) };
      fs.writeFileSync(path.join(directory, 'fixture-manifest.json'), JSON.stringify(publicState, null, 2));
    };
    await reconcile({ state, save, api: {
      async listUsers() {
        const all = [];
        for (let page = 1; page <= 10000; page++) {
          const data = unwrap(await client.auth.admin.listUsers({ page, perPage: 100 }));
          all.push(...data.users);
          if (data.users.length < 100) return all;
        }
        throw Error('User pagination limit reached');
      },
      async createUser(input) { return unwrap(await client.auth.admin.createUser(input)).user; },
      async profile(id) { return unwrap(await client.from('profiles').select('id,email,role,vendor_id,suspended,deleted_at').eq('id', id).single()); },
      async vendor(id) { return unwrap(await client.from('vendors').select('id,owner_id,name,status,archived_at').eq('id', id).single()); },
    } });
    console.log('Four staging identities reconciled. UUID manifest saved locally; admin promotion and onboarding are separate.');
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Provisioning stopped. No credentials logged. Inspect local checkpoint; do not blindly retry ambiguous writes.'); process.exitCode = 1; });
}
