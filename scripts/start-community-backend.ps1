param([string]$Python)
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python
& $Python -m uvicorn silver_companion_community.main:app --app-dir "$root\code3-community\backend\src" --host 127.0.0.1 --port 8003

