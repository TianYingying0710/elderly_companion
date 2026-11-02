param([string]$Python)

# 本地启动社区端后端。仅负责「在正确目录、以正确数据库路径」拉起进程；
# 不安装依赖、不建表、不写 seed，数据库与建表仍由应用自身负责。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'code3-community\backend'
. (Join-Path $PSScriptRoot 'resolve-python.ps1')
$Python = Resolve-SilverCompanionPython -ExplicitPython $Python

# 记录调用者原有状态，脚本结束后原样恢复，避免污染当前 PowerShell 会话。
$hadDatabasePath = Test-Path Env:COMMUNITY_DATABASE_PATH
$previousDatabasePath = $env:COMMUNITY_DATABASE_PATH

$exitCode = 0
try {
    # 工作目录固定为社区后端，保证相对路径与模块解析不随调用位置变化。
    Push-Location $backend

    # 只有调用者未显式配置时才注入本地开发默认值；显式配置优先，不覆盖。
    if (-not $hadDatabasePath -or [string]::IsNullOrWhiteSpace($previousDatabasePath)) {
        $env:COMMUNITY_DATABASE_PATH = Join-Path $backend 'data\community.db'
    }

    # 原生进程把日志写到 stderr；当调用方捕获或重定向输出时，这些日志会被提升为
    # 终止错误，导致服务刚启动就退出。仅在这一次调用期间放宽为 Continue，
    # 脚本自身的其它错误仍保持 Stop。
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Python -m uvicorn silver_companion_community.main:app --app-dir (Join-Path $backend 'src') --host 127.0.0.1 --port 8003
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
}
finally {
    # 恢复环境变量：原先未设置则回到未设置，原先有值则回到原值。
    if ($hadDatabasePath) {
        $env:COMMUNITY_DATABASE_PATH = $previousDatabasePath
    }
    elseif (Test-Path Env:COMMUNITY_DATABASE_PATH) {
        Remove-Item Env:COMMUNITY_DATABASE_PATH -ErrorAction SilentlyContinue
    }

    Pop-Location
}

exit $exitCode
