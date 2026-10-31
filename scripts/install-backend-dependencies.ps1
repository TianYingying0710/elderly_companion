param(
    [string]$Python,
    [string]$CacheDirectory,
    [string]$TempDirectory
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python

if ($CacheDirectory) {
    New-Item -ItemType Directory -Force -Path $CacheDirectory | Out-Null
    $env:PIP_CACHE_DIR = $CacheDirectory
}

if ($TempDirectory) {
    New-Item -ItemType Directory -Force -Path $TempDirectory | Out-Null
    $env:TEMP = $TempDirectory
    $env:TMP = $TempDirectory
}

& $Python -m pip install `
    -e "$root\code4-shared[test]" `
    -e "$root\code1-elder\backend[test]" `
    -e "$root\code2-guardian\backend[test]" `
    -e "$root\code3-community\backend[test]"

