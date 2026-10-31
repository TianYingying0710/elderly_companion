$ErrorActionPreference = 'Stop'

$scriptsRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $scriptsRoot 'resolve-python.ps1')

function Assert-Equal {
    param([string]$Expected, [string]$Actual, [string]$Message)

    if ($Expected -ne $Actual) {
        throw "$Message`nExpected: $Expected`nActual:   $Actual"
    }
}

$testRoot = Join-Path $PSScriptRoot '.tmp'
$explicitPython = Join-Path $testRoot 'explicit-python.exe'
$environmentPython = Join-Path $testRoot 'environment-python.exe'
$pathRoot = Join-Path $testRoot 'path'
$pathPython = Join-Path $pathRoot 'python.cmd'

try {
    New-Item -ItemType Directory -Path $pathRoot -Force | Out-Null
    New-Item -ItemType File -Path $explicitPython -Force | Out-Null
    New-Item -ItemType File -Path $environmentPython -Force | Out-Null
    Set-Content -LiteralPath $pathPython -Value '@echo off' -Encoding ASCII

    $originalEnvironmentPython = $env:SILVER_COMPANION_PYTHON
    $originalPath = $env:PATH

    $env:SILVER_COMPANION_PYTHON = $environmentPython
    Assert-Equal $explicitPython (Resolve-SilverCompanionPython -ExplicitPython $explicitPython) 'Explicit parameter must take precedence.'
    Assert-Equal $environmentPython (Resolve-SilverCompanionPython) 'Environment variable must be used when no parameter is supplied.'

    $env:SILVER_COMPANION_PYTHON = $null
    $env:PATH = $pathRoot
    Assert-Equal $pathPython (Resolve-SilverCompanionPython) 'Python on PATH must be used as the final fallback.'

    $env:PATH = $testRoot
    $didThrow = $false
    try {
        Resolve-SilverCompanionPython | Out-Null
    }
    catch {
        $didThrow = $_.Exception.Message -like '*Python executable not found*'
    }
    if (-not $didThrow) {
        throw 'Missing Python must produce a clear error.'
    }

    Write-Output 'environment script tests passed'
}
finally {
    $env:SILVER_COMPANION_PYTHON = $originalEnvironmentPython
    $env:PATH = $originalPath
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
