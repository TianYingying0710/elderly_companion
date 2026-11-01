$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifyScript = Join-Path $root 'scripts\verify-framework.ps1'
$testRoot = Join-Path $PSScriptRoot '.tmp-verify-framework'
$fakeBin = Join-Path $testRoot 'bin'
$logFile = Join-Path $testRoot 'python-working-directories.txt'
$fakePython = Join-Path $fakeBin 'python.cmd'
$fakeNpm = Join-Path $fakeBin 'npm.cmd'
$originalPath = $env:PATH
$originalLogFile = $env:VERIFY_FRAMEWORK_TEST_LOG

try {
    New-Item -ItemType Directory -Path $fakeBin -Force | Out-Null
    Set-Content -LiteralPath $fakeNpm -Encoding ASCII -Value @(
        '@echo off',
        'exit /b 0'
    )
    Set-Content -LiteralPath $fakePython -Encoding ASCII -Value @(
        '@echo off',
        'cd>>"%VERIFY_FRAMEWORK_TEST_LOG%"',
        'exit /b 0'
    )

    $env:PATH = "$fakeBin;$originalPath"
    $env:VERIFY_FRAMEWORK_TEST_LOG = $logFile

    & $verifyScript -Python $fakePython
    if ($LASTEXITCODE -ne 0) {
        throw "verify-framework.ps1 returned exit code $LASTEXITCODE"
    }

    $actual = @(Get-Content -LiteralPath $logFile)
    $expected = @(
        (Join-Path $root 'code1-elder\backend'),
        (Join-Path $root 'code2-guardian\backend'),
        (Join-Path $root 'code3-community\backend'),
        (Join-Path $root 'code4-shared')
    )

    if ($actual.Count -ne $expected.Count) {
        throw "Expected $($expected.Count) Python invocations, got $($actual.Count)."
    }
    for ($index = 0; $index -lt $expected.Count; $index++) {
        if ($actual[$index] -ne $expected[$index]) {
            throw "Python invocation $index used the wrong working directory.`nExpected: $($expected[$index])`nActual:   $($actual[$index])"
        }
    }

    Write-Output 'verify framework working-directory tests passed'
}
finally {
    $env:PATH = $originalPath
    $env:VERIFY_FRAMEWORK_TEST_LOG = $originalLogFile
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
