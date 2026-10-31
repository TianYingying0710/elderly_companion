param([string]$JavaHome=$env:JAVA_HOME,[string]$AndroidSdk=$env:ANDROID_SDK_ROOT,[string]$GradleUserHome=$env:GRADLE_USER_HOME,[string]$AndroidUserHome=$env:ANDROID_USER_HOME)
$ErrorActionPreference='Stop'
if ([string]::IsNullOrWhiteSpace($AndroidSdk)) { $AndroidSdk=$env:ANDROID_HOME }
$checks=@{JAVA_HOME=$JavaHome;ANDROID_SDK=$AndroidSdk;GRADLE_USER_HOME=$GradleUserHome;ANDROID_USER_HOME=$AndroidUserHome}
foreach($item in $checks.GetEnumerator()){if([string]::IsNullOrWhiteSpace($item.Value)-or -not(Test-Path -LiteralPath $item.Value)){throw "$($item.Key) is missing or invalid."}}
$java=Join-Path $JavaHome 'bin\java.exe';$adb=Join-Path $AndroidSdk 'platform-tools\adb.exe'
$apksigner=Get-ChildItem -LiteralPath (Join-Path $AndroidSdk 'build-tools') -Recurse -Filter apksigner.bat -ErrorAction Stop|Sort-Object FullName -Descending|Select-Object -First 1 -ExpandProperty FullName
foreach($tool in @($java,$adb,$apksigner)){if(-not(Test-Path -LiteralPath $tool -PathType Leaf)){throw "Required Android tool is missing: $tool"}}
$keystore=Join-Path $AndroidUserHome 'debug.keystore';if(-not(Test-Path -LiteralPath $keystore -PathType Leaf)){throw "Debug keystore is missing: $keystore"}
[pscustomobject]@{Java=$java;Adb=$adb;ApkSigner=$apksigner;GradleUserHome=$GradleUserHome;DebugKeystore=$keystore}
