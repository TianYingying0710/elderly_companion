param(
    [string]$Python
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python

$testsDir = Join-Path $root 'scripts\acceptance\tests'
$selfTestOut = [System.IO.Path]::GetTempFileName()
$selfTestErr = [System.IO.Path]::GetTempFileName()

# unittest writes its summary to stderr, and PowerShell wraps native stderr in
# error records. Redirect both streams to files so the raw text can be checked.
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    & $Python -m unittest discover -s $testsDir -p 'test_support.py' 1> $selfTestOut 2> $selfTestErr
    $selfTestExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
}

$selfTestOutput = @()
foreach ($file in @($selfTestOut, $selfTestErr)) {
    if (Test-Path -LiteralPath $file) {
        $selfTestOutput += @(Get-Content -LiteralPath $file)
    }
}
Remove-Item -LiteralPath $selfTestOut, $selfTestErr -Force -ErrorAction SilentlyContinue
foreach ($line in $selfTestOutput) { Write-Host $line }

if ($selfTestExitCode -ne 0) { exit $selfTestExitCode }

# Trusting only the exit code is not enough: some unittest versions exit 0 with
# zero collected tests. Require its own summary with a positive count (so
# "Ran 0 tests in 0.000s" is rejected) and refuse the explicit marker too.
# The test count itself stays un-hardcoded.
$selfTestText = $selfTestOutput -join "`n"
if ($selfTestText -match 'NO TESTS RAN') {
    [Console]::Error.WriteLine('verify-acceptance: support self-test reported NO TESTS RAN; refusing to continue.')
    exit 1
}
if ($selfTestText -notmatch '(?m)^Ran ([1-9]\d*) tests? in ') {
    [Console]::Error.WriteLine('verify-acceptance: support self-test printed no positive "Ran N tests" summary (zero collected tests are rejected); refusing to continue.')
    exit 1
}
$summaryLines = @($selfTestOutput | Where-Object { $_.Trim() -ne '' })
if ($summaryLines.Count -eq 0) {
    [Console]::Error.WriteLine('verify-acceptance: support self-test printed no summary at all; refusing to continue.')
    exit 1
}
if ($summaryLines[-1].Trim() -notmatch '^OK( \(.*\))?$') {
    [Console]::Error.WriteLine("verify-acceptance: support self-test did not end with OK (last line: $($summaryLines[-1])).")
    exit 1
}

& $Python (Join-Path $root 'scripts\acceptance\run_acceptance.py') --python $Python --root $root
exit $LASTEXITCODE
