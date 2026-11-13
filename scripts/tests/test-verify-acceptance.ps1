$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifyScript = Join-Path $root 'scripts\verify-acceptance.ps1'
$testRoot = Join-Path $PSScriptRoot '.tmp-verify-acceptance'
$fakePython = Join-Path $testRoot 'python.cmd'
$logFile = Join-Path $testRoot 'invocations.txt'
$originalLogFile = $env:VERIFY_ACCEPTANCE_TEST_LOG

try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    Set-Content -LiteralPath $fakePython -Encoding ASCII -Value @(
        '@echo off',
        '>>"%VERIFY_ACCEPTANCE_TEST_LOG%" echo %*',
        'exit /b 0'
    )
    $env:VERIFY_ACCEPTANCE_TEST_LOG = $logFile

    & $verifyScript -Python $fakePython
    if ($LASTEXITCODE -ne 0) {
        throw "verify-acceptance.ps1 returned exit code $LASTEXITCODE"
    }

    $lines = @(Get-Content -LiteralPath $logFile)
    if ($lines.Count -ne 2) {
        throw "Expected 2 Python invocations, got $($lines.Count)."
    }
    if ($lines[0] -notmatch '-m unittest discover') {
        throw "First invocation is not the support self-test: $($lines[0])"
    }
    if ($lines[1] -notmatch 'run_acceptance\.py') {
        throw "Second invocation is not the orchestrator: $($lines[1])"
    }
    if ($lines[1] -notmatch [regex]::Escape("--python $fakePython")) {
        throw "Orchestrator did not receive the resolved Python path: $($lines[1])"
    }
    if ($lines[1] -notmatch [regex]::Escape("--root $root")) {
        throw "Orchestrator did not receive the repository root: $($lines[1])"
    }

    $content = Get-Content -LiteralPath $verifyScript -Raw
    if ($content -match 'verify-framework') {
        throw 'verify-acceptance.ps1 must not call verify-framework.ps1'
    }
    if ($content -match '(?i)pip\s+install|npm\s+(install|i)\b') {
        throw 'verify-acceptance.ps1 must not install dependencies'
    }

    Write-Output 'verify acceptance wiring tests passed'
}
finally {
    $env:VERIFY_ACCEPTANCE_TEST_LOG = $originalLogFile
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
