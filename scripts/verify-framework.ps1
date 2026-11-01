param(
    [string]$Python,
    [switch]$IncludeAndroid
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python

& npm --prefix "$root\code1-elder\frontend" test
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm --prefix "$root\code1-elder\frontend" run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

foreach ($frontend in @('code2-guardian', 'code3-community')) {
    & npm --prefix "$root\$frontend\frontend" test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & npm --prefix "$root\$frontend\frontend" run build:mp-weixin
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if ($IncludeAndroid) {
    & npm --prefix "$root\code1-elder\frontend" run android:verify
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

foreach ($backend in @('code1-elder', 'code2-guardian', 'code3-community')) {
    $backendRoot = "$root\$backend\backend"
    Push-Location $backendRoot
    try {
        & $Python -m pytest 'tests' -q
        $testExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($testExitCode -ne 0) { exit $testExitCode }
}

$sharedRoot = "$root\code4-shared"
Push-Location $sharedRoot
try {
    & $Python -m pytest 'tests' -q
    $testExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $testExitCode
