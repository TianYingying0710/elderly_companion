function Resolve-SilverCompanionPython {
    param([string]$ExplicitPython)

    $candidates = @(
        $ExplicitPython,
        $env:SILVER_COMPANION_PYTHON
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
        throw "Python executable not found: $candidate"
    }

    $pythonCommand = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($pythonCommand) {
        return $pythonCommand.Source
    }

    throw 'Python executable not found. Pass -Python, set SILVER_COMPANION_PYTHON, or activate an environment that provides python on PATH.'
}
