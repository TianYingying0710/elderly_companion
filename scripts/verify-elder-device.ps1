param([Parameter(Mandatory)][string]$Apk,[string]$Device,[string]$Package='com.silvercompanion.elder',[string]$Activity='.MainActivity')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'android-signing.ps1')
$tools=& (Join-Path $PSScriptRoot 'test-elder-android-environment.ps1')
if(-not(Test-Path -LiteralPath $Apk -PathType Leaf)){throw "APK not found: $Apk"}
$adbArgs=@();if($Device){$adbArgs=@('-s',$Device)}
$devices=(& $tools.Adb devices -l)-join "`n";if($Device -and $devices -notmatch ('(?m)^'+[regex]::Escape($Device)+'\s+device\b')){throw "Android device is not connected: $Device"}
$remote=(& $tools.Adb @adbArgs shell pm path $Package|Select-Object -First 1)-replace '^package:',''
if(-not $remote){throw "Package is not installed: $Package"}
$temporary=Join-Path ([IO.Path]::GetTempPath()) ("elder-installed-{0}.apk" -f [guid]::NewGuid())
try{
  & $tools.Adb @adbArgs pull $remote $temporary|Out-Null
  $installedOutput=& $tools.ApkSigner verify --print-certs $temporary;if($LASTEXITCODE-ne 0){throw 'Installed APK signature verification failed.'};$installed=Get-SigningDigests $installedOutput
  $candidateOutput=& $tools.ApkSigner verify --print-certs $Apk;if($LASTEXITCODE-ne 0){throw 'Candidate APK signature verification failed.'};$candidate=Get-SigningDigests $candidateOutput
  if((Compare-Object $installed $candidate).Count-ne 0){throw "APK signing certificate mismatch. Installed=$($installed-join ',') Candidate=$($candidate-join ',')"}
  & $tools.Adb @adbArgs install -r $Apk
  if($LASTEXITCODE-ne 0){throw 'APK install failed.'}
  & $tools.Adb @adbArgs shell am start -n "$Package/$Activity"|Out-Null
  $foreground=$false
  for($attempt=0;$attempt-lt 12;$attempt++){
    $front=(& $tools.Adb @adbArgs shell dumpsys activity activities)-join "`n"
    if($front-match ('topResumedActivity=.*'+[regex]::Escape("$Package/$Activity"))){$foreground=$true;break}
    Start-Sleep -Milliseconds 250
  }
  if(-not $foreground){throw 'Elder app did not reach the foreground.'}
  Write-Output "Verified $Package on $Device with SHA-256 $($candidate-join ',')"
}finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -Force}}
