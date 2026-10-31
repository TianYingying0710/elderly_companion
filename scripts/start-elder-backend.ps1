param(
    [string]$Python,
    [string]$BindAddress = '0.0.0.0'
)
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python
& $Python -m uvicorn silver_companion_elder.main:app --app-dir "$root\code1-elder\backend\src" --host $BindAddress --port 8001

