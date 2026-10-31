$frontend = Join-Path (Split-Path -Parent $PSScriptRoot) 'code1-elder\frontend'
& npm --prefix $frontend run dev

