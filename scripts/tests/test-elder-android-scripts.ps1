$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$environmentScript = Join-Path $root 'scripts\test-elder-android-environment.ps1'
$deviceScript = Join-Path $root 'scripts\verify-elder-device.ps1'
$signingScript = Join-Path $root 'scripts\android-signing.ps1'
foreach ($file in @($environmentScript, $deviceScript)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing script: $file" }
}
. $signingScript
$left=Get-SigningDigests @('Signer #1 certificate SHA-256 digest: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Signer #2 certificate SHA-256 digest: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
$right=Get-SigningDigests @('Signer #1 certificate SHA-256 digest: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc','Signer #2 certificate SHA-256 digest: dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')
if((Compare-Object $left $right).Count-eq 0){throw 'Different multi-signer digest sets must not compare equal.'}
$environmentText=Get-Content -LiteralPath $environmentScript -Raw
if($environmentText-notmatch 'ANDROID_USER_HOME' -or $environmentText-notmatch 'debug.keystore'){throw 'Environment preflight must validate the debug keystore.'}
$package=Get-Content -LiteralPath (Join-Path $root 'code1-elder\frontend\package.json') -Raw|ConvertFrom-Json
$preflight=($package.scripts.'android:verify' -split '-File\s+')[1].Split(' ')[0]
$resolved=[IO.Path]::GetFullPath((Join-Path (Join-Path $root 'code1-elder\frontend') $preflight))
if(-not(Test-Path -LiteralPath $resolved)){throw "android:verify preflight path is invalid: $resolved"}
$deviceText = Get-Content -LiteralPath $deviceScript -Raw
if ($deviceText -notmatch 'install' -or $deviceText -notmatch 'SHA-256') { throw 'Device script must compare signing certificates before install.' }
if ($deviceText -match 'uninstall') { throw 'Device verification must never uninstall the existing app.' }
if ($deviceText -notmatch '\\s\+device') { throw 'Device detection must accept the variable whitespace used by adb devices -l.' }
if ($deviceText -notmatch 'topResumedActivity' -or $deviceText -notmatch 'Start-Sleep') { throw 'Foreground verification must poll until Android resumes the activity.' }
Write-Output 'Android script boundary tests passed.'
