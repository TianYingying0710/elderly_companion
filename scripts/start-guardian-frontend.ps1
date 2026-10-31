$frontend = Join-Path (Split-Path -Parent $PSScriptRoot) 'code2-guardian\frontend'
& npm --prefix $frontend run dev

