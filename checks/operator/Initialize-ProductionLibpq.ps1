# Run interactively by the authorised operator. Local files only; no database call.
# Never supply the database password as an argument or environment variable.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRef = 'gfzhdkitdyqftealgqfi'
$operatorSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$recoveryBase = Join-Path $env:LOCALAPPDATA 'OfficeBitesRecovery'

function Assert-NoReparseAncestor([string]$Candidate) {
    $ancestor = [IO.Path]::GetFullPath($Candidate)
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw 'Reparse paths are not allowed for recovery files.'
            }
        }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
}
function Set-PrivateDirectory([string]$Directory) {
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetOwner($operatorSid)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @($operatorSid, $systemSid)) {
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Directory -AclObject $acl
}
function Escape-Pgpass([string]$Value) {
    return $Value.Replace('\', '\\').Replace(':', '\:')
}

Write-Host 'Select OfficeBites production gfzhdkitdyqftealgqfi in Supabase > Connect.'
Write-Host 'Use Session pooler (port 5432) on this machine, not Transaction pooler.'
$connectionKind = Read-Host 'Connection method: session or direct'
$dbHost = (Read-Host 'Exact Host from the selected Connect panel (no URI/password)').Trim().ToLowerInvariant()
$dbUser = (Read-Host 'Exact User from that same panel').Trim()
if ($connectionKind -eq 'session') {
    if ($dbHost -notmatch '^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$' -or $dbUser -cne "postgres.$projectRef") {
        throw 'Expected project-scoped Session pooler user and dashboard pooler host.'
    }
} elseif ($connectionKind -eq 'direct') {
    if ($dbHost -cne "db.$projectRef.supabase.co" -or $dbUser -cne 'postgres') {
        throw 'Direct connection does not match the confirmed production project.'
    }
} else { throw 'Select session or direct; no transaction-pooler connection allowed.' }
$confirmation = Read-Host 'Type the production project reference to confirm the Connect panel'
if ($confirmation -cne $projectRef) { throw 'Project not confirmed.' }
$caInput = (Read-Host 'Full path to the CA certificate downloaded from project SSL settings').Trim('"')
$caSource = (Resolve-Path -LiteralPath $caInput).ProviderPath
if ((Get-Item -LiteralPath $caSource).Length -gt 1048576) { throw 'Unexpected certificate size.' }
$caText = [IO.File]::ReadAllText($caSource)
if ($caText -notmatch '-----BEGIN CERTIFICATE-----' -or $caText -match 'PRIVATE KEY') { throw 'CA certificate PEM required.' }

Assert-NoReparseAncestor $recoveryBase
if (-not (Test-Path -LiteralPath $recoveryBase)) { New-Item -ItemType Directory -Path $recoveryBase | Out-Null }
# Fresh unique directory only: do not alter ACLs or overwrite any existing secrets.
$privateDir = Join-Path $recoveryBase ('production-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $privateDir | Out-Null
Set-PrivateDirectory $privateDir
$privateAcl = Get-Acl -LiteralPath $privateDir
if (-not $privateAcl.AreAccessRulesProtected) { throw 'Private ACL inheritance must be disabled.' }
foreach ($rule in $privateAcl.Access) {
    $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    if ($sid -notin @($operatorSid.Value, $systemSid.Value) -or $rule.AccessControlType -ne 'Allow') { throw 'Unexpected private directory ACL.' }
}
$caFile = Join-Path $privateDir 'production-ca.pem'
$passFile = Join-Path $privateDir 'production.pgpass'
$serviceFile = Join-Path $privateDir 'production.pg_service.conf'
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($caFile, $caText, $utf8)
$securePassword = Read-Host 'Production DATABASE password (masked; not your dashboard password)' -AsSecureString
$bstr = [IntPtr]::Zero
$plainPassword = $null
$passLine = $null
try {
    if ($securePassword.Length -eq 0) { throw 'Empty password is not allowed.' }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ($plainPassword -match '[\r\n\x00]') { throw 'Password contains unsupported line breaks or NUL.' }
    $passLine = '{0}:5432:postgres:{1}:{2}' -f (Escape-Pgpass $dbHost), (Escape-Pgpass $dbUser), (Escape-Pgpass $plainPassword)
    [IO.File]::WriteAllText($passFile, $passLine + "`n", $utf8)
    $serviceText = @(
        '[officebites_production]', "host=$dbHost", 'port=5432', 'dbname=postgres', "user=$dbUser",
        'sslmode=verify-full', ('sslrootcert=' + $caFile.Replace('\', '/')),
        'connect_timeout=15', 'application_name=officebites_production_backup_readonly',
        'options=-c default_transaction_read_only=on -c lock_timeout=5s -c statement_timeout=60000'
    ) -join "`n"
    [IO.File]::WriteAllText($serviceFile, $serviceText + "`n", $utf8)
} finally {
    if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $plainPassword = $null
    $passLine = $null
    if ($securePassword) { $securePassword.Dispose() }
}
Write-Host 'Local configuration created. No connection attempted; no password displayed.'
Write-Host 'PGSERVICE=officebites_production'
Write-Host "PGSERVICEFILE=$serviceFile"
Write-Host "PGPASSFILE=$passFile"
Write-Host "Private recovery directory: $privateDir"
Write-Host 'Provide only these file paths to Codex. Keep file contents private.'
