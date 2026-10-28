# Synthetic-only ACL and escaping test. Does not invoke the interactive setup.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$operatorSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Initialize-ProductionLibpq.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Setup syntax errors.' }
$definitions = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)
foreach ($definition in $definitions) {
    # Execute only these trusted local function definitions, never prompt/file code.
    Invoke-Expression $definition.Extent.Text
}
if ((Escape-Pgpass 'SYNTHETIC\:only') -cne 'SYNTHETIC\\\:only') { throw 'libpq escaping failed.' }
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$testDirectory = Join-Path $releaseRoot ('.officebites-local\setup-acl-test-' + [Guid]::NewGuid().ToString('N'))
if (-not $testDirectory.StartsWith($releaseRoot + '\')) { throw 'Outside fixture workspace.' }
New-Item -ItemType Directory -Path $testDirectory -ErrorAction Stop | Out-Null
try {
    Assert-NoReparseAncestor $testDirectory
    Set-PrivateDirectory $testDirectory
    $acl = Get-Acl -LiteralPath $testDirectory
    if (-not $acl.AreAccessRulesProtected -or $acl.Owner -eq $null) { throw 'ACL protection failed.' }
    $sids = @($acl.Access | ForEach-Object {
        if ($_.IsInherited -or $_.AccessControlType -ne 'Allow') { throw 'Unexpected ACL rule.' }
        $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    })
    if ($sids.Count -ne 2 -or $operatorSid.Value -notin $sids -or $systemSid.Value -notin $sids) { throw 'Unexpected ACL identities.' }
    Write-Host 'Setup syntax, synthetic pgpass escaping and current-user/SYSTEM directory ACL passed. No credentials created.'
} finally {
    # Only the positively identified empty fixture directory; no recursive deletion.
    if ([IO.Directory]::GetFileSystemEntries($testDirectory).Length -ne 0) { throw 'Unexpected fixture contents; retained.' }
    Remove-Item -LiteralPath $testDirectory
}
