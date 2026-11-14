$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifyScript = Join-Path $root 'scripts\verify-acceptance.ps1'
$testRoot = Join-Path $PSScriptRoot '.tmp-verify-acceptance'
$fakePython = Join-Path $testRoot 'python.cmd'
$logFile = Join-Path $testRoot 'invocations.txt'
$originalLogFile = $env:VERIFY_ACCEPTANCE_TEST_LOG
$originalUnittestExit = $env:VERIFY_ACCEPTANCE_TEST_UNITTEST_EXIT
$originalOrchestratorExit = $env:VERIFY_ACCEPTANCE_TEST_ORCHESTRATOR_EXIT
$originalQuiet = $env:VERIFY_ACCEPTANCE_TEST_QUIET
$originalZeroTests = $env:VERIFY_ACCEPTANCE_TEST_ZERO_TESTS
$originalNoTestsRan = $env:VERIFY_ACCEPTANCE_TEST_NO_TESTS_RAN

function Reset-FakePythonControls {
    $env:VERIFY_ACCEPTANCE_TEST_UNITTEST_EXIT = $null
    $env:VERIFY_ACCEPTANCE_TEST_ORCHESTRATOR_EXIT = $null
    $env:VERIFY_ACCEPTANCE_TEST_QUIET = $null
    $env:VERIFY_ACCEPTANCE_TEST_ZERO_TESTS = $null
    $env:VERIFY_ACCEPTANCE_TEST_NO_TESTS_RAN = $null
}

function Reset-InvocationLog {
    if (Test-Path -LiteralPath $logFile) {
        Remove-Item -LiteralPath $logFile -Force
    }
}

function Get-InvocationLines {
    return @(Get-Content -LiteralPath $logFile)
}

try {
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    Set-Content -LiteralPath $fakePython -Encoding ASCII -Value @(
        '@echo off',
        '>>"%VERIFY_ACCEPTANCE_TEST_LOG%" echo %*',
        'echo %* | findstr /C:"-m unittest" >nul',
        'if errorlevel 1 goto orchestrator',
        'if defined VERIFY_ACCEPTANCE_TEST_UNITTEST_EXIT exit /b %VERIFY_ACCEPTANCE_TEST_UNITTEST_EXIT%',
        'if defined VERIFY_ACCEPTANCE_TEST_QUIET exit /b 0',
        'if defined VERIFY_ACCEPTANCE_TEST_ZERO_TESTS goto zerotests',
        'if defined VERIFY_ACCEPTANCE_TEST_NO_TESTS_RAN goto notestsran',
        'echo Ran 17 tests in 0.001s',
        'echo.',
        'echo OK',
        'exit /b 0',
        ':zerotests',
        'echo Ran 0 tests in 0.000s',
        'echo.',
        'echo OK',
        'exit /b 0',
        ':notestsran',
        'echo Ran 0 tests in 0.000s',
        'echo.',
        'echo NO TESTS RAN',
        'exit /b 0',
        ':orchestrator',
        'if defined VERIFY_ACCEPTANCE_TEST_ORCHESTRATOR_EXIT exit /b %VERIFY_ACCEPTANCE_TEST_ORCHESTRATOR_EXIT%',
        'echo ACCEPTANCE PASS (33 checks)',
        'exit /b 0'
    )
    $env:VERIFY_ACCEPTANCE_TEST_LOG = $logFile

    # Path 1: support self-test and orchestrator both succeed.
    Reset-FakePythonControls
    Reset-InvocationLog
    & $verifyScript -Python $fakePython
    if ($LASTEXITCODE -ne 0) {
        throw "verify-acceptance.ps1 returned exit code $LASTEXITCODE"
    }

    $lines = @(Get-InvocationLines)
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

    # Path 2: a failing support self-test must not reach the orchestrator.
    Reset-FakePythonControls
    Reset-InvocationLog
    $env:VERIFY_ACCEPTANCE_TEST_UNITTEST_EXIT = '3'
    & $verifyScript -Python $fakePython
    $selfTestExit = $LASTEXITCODE
    if ($selfTestExit -eq 0) {
        throw 'verify-acceptance.ps1 must fail when the support self-test fails.'
    }
    $lines = @(Get-InvocationLines)
    if ($lines.Count -ne 1) {
        throw "Orchestrator ran after a failed self-test; invocations: $($lines.Count)."
    }
    if ($lines[0] -notmatch '-m unittest discover') {
        throw "Failed run did not start with the support self-test: $($lines[0])"
    }

    # Path 3: a summary-less self-test (zero collected tests) must not pass silently.
    Reset-FakePythonControls
    Reset-InvocationLog
    $env:VERIFY_ACCEPTANCE_TEST_QUIET = '1'
    & $verifyScript -Python $fakePython
    $quietExit = $LASTEXITCODE
    if ($quietExit -eq 0) {
        throw 'verify-acceptance.ps1 must fail when the self-test prints no summary.'
    }
    $lines = @(Get-InvocationLines)
    if ($lines.Count -ne 1) {
        throw "Orchestrator ran after a summary-less self-test; invocations: $($lines.Count)."
    }

    # Path 4: a self-test that runs zero tests and still prints OK must not pass.
    Reset-FakePythonControls
    Reset-InvocationLog
    $env:VERIFY_ACCEPTANCE_TEST_ZERO_TESTS = '1'
    & $verifyScript -Python $fakePython
    $zeroTestExit = $LASTEXITCODE
    if ($zeroTestExit -ne 1) {
        throw "Expected exit code 1 when the self-test runs zero tests, got $zeroTestExit."
    }
    $lines = @(Get-InvocationLines)
    if ($lines.Count -ne 1) {
        throw "Orchestrator ran after a zero-test self-test; invocations: $($lines.Count)."
    }
    if ($lines[0] -notmatch '-m unittest discover') {
        throw "Zero-test run did not start with the support self-test: $($lines[0])"
    }

    # Path 5: an explicit "NO TESTS RAN" marker is rejected as well.
    Reset-FakePythonControls
    Reset-InvocationLog
    $env:VERIFY_ACCEPTANCE_TEST_NO_TESTS_RAN = '1'
    & $verifyScript -Python $fakePython
    $noTestsExit = $LASTEXITCODE
    if ($noTestsExit -ne 1) {
        throw "Expected exit code 1 when the self-test reports NO TESTS RAN, got $noTestsExit."
    }
    $lines = @(Get-InvocationLines)
    if ($lines.Count -ne 1) {
        throw "Orchestrator ran after a NO TESTS RAN self-test; invocations: $($lines.Count)."
    }

    # Path 6: a non-zero orchestrator exit code must be propagated.
    Reset-FakePythonControls
    Reset-InvocationLog
    $env:VERIFY_ACCEPTANCE_TEST_ORCHESTRATOR_EXIT = '7'
    & $verifyScript -Python $fakePython
    $orchestratorExit = $LASTEXITCODE
    if ($orchestratorExit -eq 0) {
        throw 'verify-acceptance.ps1 must propagate a non-zero orchestrator exit code.'
    }
    if ($orchestratorExit -ne 7) {
        throw "Expected orchestrator exit code 7 to be propagated, got $orchestratorExit."
    }
    $lines = @(Get-InvocationLines)
    if ($lines.Count -ne 2) {
        throw "Expected 2 Python invocations on orchestrator failure, got $($lines.Count)."
    }

    Reset-FakePythonControls

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
    $env:VERIFY_ACCEPTANCE_TEST_UNITTEST_EXIT = $originalUnittestExit
    $env:VERIFY_ACCEPTANCE_TEST_ORCHESTRATOR_EXIT = $originalOrchestratorExit
    $env:VERIFY_ACCEPTANCE_TEST_QUIET = $originalQuiet
    $env:VERIFY_ACCEPTANCE_TEST_ZERO_TESTS = $originalZeroTests
    $env:VERIFY_ACCEPTANCE_TEST_NO_TESTS_RAN = $originalNoTestsRan
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
