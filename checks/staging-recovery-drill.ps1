# Local synthetic cluster ONLY. Does not accept a database URL or hosted target.
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskData=[IO.Path]::GetFullPath((Join-Path $taskRoot '.officebites-local/pg-release-owner-data'))
$taskRestore=[IO.Path]::GetFullPath((Join-Path $taskRoot '.officebites-local/pg-staging-recovery-copy-20261027'))
$taskAllowed=[IO.Path]::GetFullPath((Join-Path $taskRoot '.officebites-local'))+[IO.Path]::DirectorySeparatorChar
foreach($taskTarget in @($taskData,$taskRestore)){if(-not $taskTarget.StartsWith($taskAllowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Target outside release local-artifact directory'}}
if(Test-Path -LiteralPath $taskRestore){throw 'Refuse to overwrite an existing restore copy'}
if(@(Get-ChildItem -LiteralPath (Join-Path $taskData 'pg_tblspc') -Force).Count -ne 0){throw 'External tablespaces are not allowed in this drill'}
$taskPre=Get-Content (Join-Path $taskRoot 'docs/release/staging-cold-restore-preimage.json') -Raw|ConvertFrom-Json
if(-not $taskPre.syntheticOnly){throw 'Synthetic evidence required'}
$taskNative=Join-Path $taskRoot '../../../.officebites-local/native-runtime/node_modules/@embedded-postgres/windows-x64/native/bin'
$taskEdge=Get-ChildItem 'C:/Program Files (x86)/Microsoft/Edge/Application' -Directory | Where-Object {Test-Path (Join-Path $_.FullName 'msvcp140.dll')} | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
$taskNode=Join-Path $env:TEMP 'officebites-legal-node/node-v24.22.0-win-x64/node.exe'
$env:PATH="$taskEdge;$env:PATH"
& (Join-Path $taskNative 'pg_ctl.exe') stop -D $taskData -m fast -w -t 30
if($LASTEXITCODE -ne 0){throw 'Could not prove clean source shutdown; no backup copy made'}
Copy-Item -LiteralPath $taskData -Destination $taskRestore -Recurse
try{
 & (Join-Path $taskNative 'pg_ctl.exe') start -D $taskRestore -l (Join-Path $taskRoot '.officebites-local/pg-staging-restore.log') -o '-h 127.0.0.1 -p 55442' -w -t 30
 if($LASTEXITCODE -ne 0){throw 'Restore startup failed'}
 Push-Location $taskRoot
 try{& $taskNode checks/verify-staging-cold-restore.mjs;if($LASTEXITCODE -ne 0){throw 'Restored evidence did not match'}}finally{Pop-Location}
}finally{
 & (Join-Path $taskNative 'pg_ctl.exe') stop -D $taskRestore -m fast -w -t 30
}
# Retain both stopped directories. No source deletion, reset or automatic reopen.
