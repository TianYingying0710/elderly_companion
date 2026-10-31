$frontend = Join-Path (Split-Path -Parent $PSScriptRoot) 'code3-community\frontend'
& npm --prefix $frontend run dev

