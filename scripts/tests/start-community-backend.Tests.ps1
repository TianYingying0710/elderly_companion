# start-community-backend.ps1 的行为测试（Pester 3.4 兼容）
#
# 设计要点：
# - 用「替身 Python」（.cmd）替代真实解释器，把子进程实际收到的
#   工作目录（CWD）、COMMUNITY_DATABASE_PATH 与参数写入日志文件。
# - 脚本以「脚本调用」方式在同一会话内执行，因此可以直接断言脚本退出后
#   会话工作目录与环境变量是否被恢复。
# - 不启动真实服务、不安装依赖、不触碰数据库。

$script:TestsDir = $PSScriptRoot
$script:ScriptsDir = Split-Path -Parent $script:TestsDir
$script:RepoRoot = Split-Path -Parent $script:ScriptsDir
$script:ScriptPath = Join-Path $script:ScriptsDir 'start-community-backend.ps1'
$script:BackendRoot = Join-Path $script:RepoRoot 'code3-community\backend'
$script:DatabasePath = Join-Path $script:BackendRoot 'data\community.db'

function Clear-CommunityDatabasePath {
    # 环境变量不存在时直接跳过，避免清理动作本身抛错掩盖真实断言。
    if (Test-Path Env:COMMUNITY_DATABASE_PATH) {
        Remove-Item Env:COMMUNITY_DATABASE_PATH -ErrorAction Stop
    }
}

function New-FakePython {
    # 生成替身 Python：记录子进程真实的工作目录、环境变量与参数。
    param([Parameter(Mandatory = $true)][string]$Directory)

    $stubPath = Join-Path $Directory 'fake-python.cmd'
    $lines = @(
        '@echo off',
        '>>"%SC_TEST_LOG%" echo CWD=%CD%',
        '>>"%SC_TEST_LOG%" echo DBPATH=%COMMUNITY_DATABASE_PATH%',
        '>>"%SC_TEST_LOG%" echo ARGS=%*',
        'exit /b 0'
    )
    Set-Content -LiteralPath $stubPath -Value $lines -Encoding ASCII
    return $stubPath
}

function New-FakeStderrPython {
    # 生成向 stderr 写日志的替身：模拟 uvicorn 把 INFO 日志输出到 stderr。
    param([Parameter(Mandatory = $true)][string]$Directory)

    $stubPath = Join-Path $Directory 'fake-python-stderr.cmd'
    $lines = @(
        '@echo off',
        '>&2 echo INFO: fake startup log',
        'exit /b 0'
    )
    Set-Content -LiteralPath $stubPath -Value $lines -Encoding ASCII
    return $stubPath
}

function Invoke-StartScript {
    # 在调用方会话内执行启动脚本，并回读替身记录。
    param(
        [Parameter(Mandatory = $true)][string]$Python,
        [Parameter(Mandatory = $true)][string]$LogPath
    )

    $env:SC_TEST_LOG = $LogPath
    & $script:ScriptPath -Python $Python
    $exitCode = $LASTEXITCODE

    $childCwd = ''
    $dbPath = ''
    $argLine = ''
    if (Test-Path -LiteralPath $LogPath) {
        foreach ($line in (Get-Content -LiteralPath $LogPath)) {
            if ($line -like 'CWD=*') { $childCwd = $line.Substring(4) }
            elseif ($line -like 'DBPATH=*') { $dbPath = $line.Substring(7) }
            elseif ($line -like 'ARGS=*') { $argLine = $line.Substring(5) }
        }
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Cwd      = $childCwd
        DbPath   = $dbPath
        Args     = $argLine
    }
}

Describe 'start-community-backend.ps1' {

    It '从非仓库目录调用时，子进程工作目录仍是社区后端绝对目录' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        try {
            $stub = New-FakePython -Directory $sandbox
            $log = Join-Path $sandbox 'subprocess.log'
            Set-Location $sandbox

            $result = Invoke-StartScript -Python $stub -LogPath $log

            $result.Cwd | Should Be $script:BackendRoot
            $result.Args | Should Match ([regex]::Escape($script:BackendRoot) + '\\src')
        }
        finally {
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '未显式配置数据库变量时，采用社区后端下的绝对数据库路径' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        Clear-CommunityDatabasePath
        try {
            $stub = New-FakePython -Directory $sandbox
            $log = Join-Path $sandbox 'subprocess.log'
            Set-Location $sandbox

            $result = Invoke-StartScript -Python $stub -LogPath $log

            $result.DbPath | Should Be $script:DatabasePath
            [System.IO.Path]::IsPathRooted($result.DbPath) | Should Be $true
        }
        finally {
            Clear-CommunityDatabasePath
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '调用者已显式配置数据库变量时，不覆盖原值' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        $customPath = Join-Path $sandbox 'custom\community.db'
        $env:COMMUNITY_DATABASE_PATH = $customPath
        try {
            $stub = New-FakePython -Directory $sandbox
            $log = Join-Path $sandbox 'subprocess.log'
            Set-Location $sandbox

            $result = Invoke-StartScript -Python $stub -LogPath $log

            $result.DbPath | Should Be $customPath
        }
        finally {
            Clear-CommunityDatabasePath
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '脚本退出后恢复调用者的工作目录' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        try {
            $stub = New-FakePython -Directory $sandbox
            $log = Join-Path $sandbox 'subprocess.log'
            Set-Location $sandbox

            Invoke-StartScript -Python $stub -LogPath $log | Out-Null

            (Get-Location).Path | Should Be $sandbox
        }
        finally {
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '子进程结束后恢复原环境变量（原先未设置则仍为未设置）' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        Clear-CommunityDatabasePath
        try {
            $stub = New-FakePython -Directory $sandbox
            $log = Join-Path $sandbox 'subprocess.log'
            Set-Location $sandbox

            Invoke-StartScript -Python $stub -LogPath $log | Out-Null

            (Test-Path Env:COMMUNITY_DATABASE_PATH) | Should Be $false
        }
        finally {
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '子进程结束后保留调用者原有的环境变量取值' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        $env:COMMUNITY_DATABASE_PATH = 'keep-me.db'
        try {
            $stub = New-FakePython -Directory $sandbox
            $log = Join-Path $sandbox 'subprocess.log'
            Set-Location $sandbox

            Invoke-StartScript -Python $stub -LogPath $log | Out-Null

            $env:COMMUNITY_DATABASE_PATH | Should Be 'keep-me.db'
        }
        finally {
            Clear-CommunityDatabasePath
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '子进程向 stderr 写日志时不会被当成终止错误' {
        $sandbox = Join-Path $env:TEMP ('sc-test-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Force -Path $sandbox | Out-Null
        $originalLocation = Get-Location
        try {
            $stub = New-FakeStderrPython -Directory $sandbox
            Set-Location $sandbox

            $threw = $false
            # 2>&1 复现「调用方捕获输出」的常见用法（如写入日志文件），
            # 这正是把子进程 stderr 提升为终止错误的条件。
            try { & $script:ScriptPath -Python $stub 2>&1 | Out-Null } catch { $threw = $true }

            $threw | Should Be $false
            $LASTEXITCODE | Should Be 0
        }
        finally {
            Set-Location $originalLocation
            Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    It '脚本不包含依赖安装、seed 或跨应用操作' {
        $content = Get-Content -LiteralPath $script:ScriptPath -Raw

        $content | Should Not Match 'pip\s+install'
        $content | Should Not Match 'npm\s+(install|i)\b'
        $content | Should Not Match 'pnpm|yarn'
        # 只拦截真正的写入/建表语句；注释里出现「不写 seed」这类说明不构成 seed 操作。
        $content | Should Not Match '(?i)\b(insert|update|delete)\s+into\b'
        $content | Should Not Match '(?i)\b(create|drop|alter)\s+table\b'
        $content | Should Not Match 'code1-elder'
        $content | Should Not Match 'code2-guardian'
        $content | Should Not Match 'code4-shared'
    }
}
