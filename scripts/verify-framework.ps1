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
    & $Python -m pytest "$root\$backend\backend\tests" -q
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& $Python -m pytest "$root\code4-shared\tests" -q
exit $LASTEXITCODE
