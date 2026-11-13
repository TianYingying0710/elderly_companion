param(
    [string]$Python
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python

& $Python -m unittest discover -s (Join-Path $root 'scripts\acceptance\tests') -p 'test_support.py'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $Python (Join-Path $root 'scripts\acceptance\run_acceptance.py') --python $Python --root $root
exit $LASTEXITCODE
