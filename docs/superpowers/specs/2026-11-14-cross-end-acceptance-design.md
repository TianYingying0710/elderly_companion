# 跨端真实链路自动化验收基座 设计

## 1. 背景

当前验证分两层：

- 单测层：三端前端 Vitest、四个 Python 包 pytest，覆盖 mock/单元逻辑；
- 构建层：`scripts/verify-framework.ps1` 已串起三端测试与 `build`（build 内含 type-check）。

缺的是中间层：把三个后端真正启动起来，用临时 SQLite 库跑一遍 SOS、课程、学习记录、社区服务任务，并通过重启进程验证持久化。此前「我的求助」切片只能靠手工 curl + 页面观察，且真实后端的失败形态（503、409）没有自动化证据。

## 2. 目标

1. 一条命令完成「三端测试/构建 + 三后端真实启动 + API 链路 + 重启持久化」。
2. 零新依赖：Python 标准库 + PowerShell 内建能力 + 仓库已有 npm 脚本。
3. 不新增后端路由、契约字段或环境变量；复用 `SOS_DATABASE_PATH`、`ELDER_DATABASE_PATH`、`COMMUNITY_DATABASE_PATH`。
4. 失败信息可直接定位：步骤名、方法、URL、期望/实际状态码与响应摘要。
5. 全程只写临时目录，结束后清理；不在仓库内产生数据库文件或日志。

## 3. 非目标

- 不驱动浏览器或微信小程序 UI（前端正确性仍由 Vitest 与 build/type-check 负责）。
- 不覆盖视频 multipart 上传；课程链路用「建课（不带视频）+ 学习进度」验证。
- 不覆盖 Android、真机、推送。
- 不覆盖 AGENTS.md 仍禁止的认证、通知、RAG、老人记忆、数字画像、设备业务，以及社区端救援/知识/课程领域。
- 不替代现有单测，不改变现有测试语义。

## 4. 方案选择

### 方案 A（采用）：PowerShell 入口 + Python 标准库编排器

- `scripts/verify-acceptance.ps1`：复用 `resolve-python.ps1`，解析 Python 后调用编排器。
- `scripts/acceptance/run_acceptance.py`：负责临时库、进程、端口、HTTP 断言、重启与清理。
- `scripts/verify-framework.ps1` 增加 `-IncludeAcceptance` 开关，作为发布门禁入口。

理由：进程重启、JSON 断言、临时目录清理用 Python 标准库最直接；PowerShell 入口保持仓库既有脚本约定与 Python 解析逻辑；开关式集成不改变现有 `verify-framework.ps1` 的默认行为与既有 PowerShell 测试。

### 方案 B（未采用）：纯 PowerShell 编排

`Start-Process` + `Invoke-RestMethod` 可完成，但进程生命周期、健康等待、JSON 结构断言和重启后的端口重分配在 PowerShell 中更冗长，错误定位也更难。

### 方案 C（未采用）：pytest 验收套件

会引入「测试内启动服务」的进程管理，且与后端单测混淆；验收是否通过应独立于 pytest 收集与夹具。

## 5. 架构与接口

```
scripts/
  verify-framework.ps1        # 既有；新增 -IncludeAcceptance
  verify-acceptance.ps1       # 新增；解析 Python 并调用编排器
  acceptance/
    run_acceptance.py         # 新增；标准库编排器（CLI）
    tests/test_runner.py      # 新增；标准库 unittest，验证纯逻辑与 HTTP 断言
```

CLI：

```text
python scripts/acceptance/run_acceptance.py --python <python.exe> --root <repo-root>
```

退出码：`0` 全部通过；`1` 任一步失败（stderr 输出失败步骤与摘要）。成功时 stdout 逐步输出 `PASS Sxx <描述>`，末尾输出 `ACCEPTANCE PASS (<N> checks)`。

`scripts/verify-acceptance.ps1` 先运行编排器自测，再运行完整验收：

```powershell
& $Python -m unittest discover -s (Join-Path $root 'scripts\acceptance\tests') -p 'test_*.py'
& $Python (Join-Path $root 'scripts\acceptance\run_acceptance.py') --python $Python --root $root
```

## 6. 运行时模型

### 6.1 临时数据库

- `tempfile.mkdtemp(prefix='silver-acceptance-')` 创建本次运行目录；
- 三个库文件：`elder.db`（`ELDER_DATABASE_PATH`）、`sos.db`（`SOS_DATABASE_PATH`）、`community.db`（`COMMUNITY_DATABASE_PATH`）；
- 建表由后端按已授权例外执行 `CREATE TABLE IF NOT EXISTS`；编排器不建表、不写入 seed；
- `finally` 中先停进程再 `shutil.rmtree`，失败也不遗留临时库。

### 6.2 进程启动

每个后端一个 `uvicorn` 子进程：

```text
<python> -m uvicorn <module>:app --app-dir <backend>/src --host 127.0.0.1 --port <free-port>
```

- 工作目录：对应 `backend` 目录；
- 环境变量：继承当前环境，并前置 `PYTHONPATH=<backend>/src;<repo>/code4-shared/src`；
- 端口：绑定 `127.0.0.1:0` 取得空闲端口后立即释放，避免占用 8001/8002/8003；
- 日志：重定向到临时目录下 `elder-1.log` 等文件，进程提前退出时输出日志尾部；
- 健康等待：轮询 `GET /health`，上限 20 秒，间隔 0.2 秒；期间若进程已退出，立即失败并附日志尾部。

### 6.3 重启持久化

- 重启使用新的动态端口，但沿用同一组临时数据库环境变量；
- 停止方式：`terminate()` 后等待 10 秒，超时 `kill()`；
- 重启后只验证持久化数据，不重复完整业务流。

## 7. 验收场景

所有断言都检查 HTTP 状态码与关键 JSON 字段。

| 步骤 | 服务 | 请求 | 期望 |
| --- | --- | --- | --- |
| S01 | elder | `GET /health` | 200，`status=ok` |
| S02 | elder | `GET /api/v1/courses` | 200，非空，包含预置课程 `course-smartphone-basics` |
| S03 | elder | `POST /api/v1/courses` | 201，返回新 `course-*` id，标题/大纲一致 |
| S04 | elder | `PUT /api/v1/learning-records/{course_id}` `{"progress_percent":42}` | 200，`progress_percent=42` |
| S05 | elder | `POST /api/v1/sos-events` `{"elder_id":"elder-001","note":"自动化验收求助"}` | 201，`status=pending`，note 一致 |
| S06 | elder | `GET /api/v1/sos-events?elder_id=elder-001` | 200，包含 S05 事件 |
| S07 | elder | `PATCH /api/v1/sos-events/{id}` `{"status":"processing"}` | 200，`status=processing` |
| S08 | elder | `PATCH /api/v1/sos-events/{id}` `{"status":"pending"}` | 409（禁止回退） |
| S09 | elder | `POST /api/v1/sos-events/{id}/transitions` `{"status":"resolved"}` | 200，`status=resolved`（微信小程序兼容别名） |
| S10 | guardian | `GET /health` | 200，`status=ok` |
| S11 | guardian | `GET /api/v1/health-overview/elder-001` | 503，`error.code=health_data_source_unavailable`（诚实未接入，不伪造数据） |
| S12 | community | `GET /health` | 200，`status=ok` |
| S13 | community | `POST /api/v1/service-tasks` | 201，`status=pending` |
| S14 | community | `POST /api/v1/service-tasks/{id}/accept` | 200，`status=in_service` |
| S15 | community | `POST /api/v1/service-tasks/{id}/complete` `{"note":"自动化验收服务记录"}` | 200，`status=completed`，note 一致 |
| S16 | community | 再次 `POST .../complete` | 409（非法流转） |
| S17 | elder 重启 | `GET /api/v1/sos-events?elder_id=elder-001` | S05 事件仍为 `resolved` |
| S18 | elder 重启 | `GET /api/v1/courses` | 仍包含 S03 新建课程 |
| S19 | elder 重启 | `GET /api/v1/learning-records` | S03 课程进度仍为 42 |
| S20 | community 重启 | `GET /api/v1/service-tasks/{id}` | 仍为 `completed` 且 note 一致 |

固定数据用于新临时库，避免跨次运行污染；每次运行库文件都是全新的。

## 8. 失败与清理语义

- 任一断言失败立即抛出带步骤名的异常，停止后续步骤，退出码 1；
- 输出包含：步骤号、方法、URL、期望状态、实际状态、响应体前 500 字符；
- 不自动重试业务请求，避免掩盖真实失败；只有健康检查允许在超时窗口内轮询；
- `finally` 中终止所有仍存活的子进程并删除临时目录；
- 端口只绑定 `127.0.0.1`。

## 9. 门禁集成

发布门禁命令：

```powershell
.\scripts\verify-framework.ps1 -Python "E:\workspace\silver-companion-env\python.exe" -IncludeAcceptance
```

执行顺序保持既有不变：三国前端测试/build → 四包 pytest → 验收基座。`-IncludeAcceptance` 为可选开关：

- 不加时行为与当前完全一致，`scripts/tests/test-verify-framework.ps1` 无需改动；
- 加上时，在既有步骤全部通过后调用 `verify-acceptance.ps1`。

`scripts/tests/test-verify-acceptance.ps1` 新增一个脚本接线测试：用假 Python 记录命令行参数，确认 `verify-acceptance.ps1` 以仓库根为 `--root`、把解析后的 Python 以 `--python` 传入。

### CI 集成（仓库当前无 CI 配置）

开关的默认关闭只服务于本地兼容，不是 CI 的跳过通道。CI 中固定开启验收，并把该 job 设为分支保护的 required check；否则开关本身不构成强制力。

推荐 CI 分两步调用，失败归属更清晰（GitHub Actions 默认遇错即停，顺序与 `-IncludeAcceptance` 等价）：

```yaml
- run: .\scripts\verify-framework.ps1 -Python (Get-Command python).Source
- run: .\scripts\verify-acceptance.ps1 -Python (Get-Command python).Source
```

约束：

- Runner 必须是 `windows-latest`：入口脚本是 PowerShell，code2/code3 的构建命令也按 Windows 路径组织。
- Python 必须传绝对路径：`Resolve-SilverCompanionPython` 会把 `-Python` 当文件路径校验，裸 `python` 会直接报错；用 `(Get-Command python).Source` 或 `$env:pythonLocation\python.exe`。
- 依赖只安装仓库已声明的：`code4-shared` 与三个 backend 的 `test` extra，三端前端用 `npm ci`（三个 lock 文件均存在）。
- 不需要 Docker、数据库服务、secrets 或外部网络模型：验收只使用 `127.0.0.1` 动态端口和系统临时目录。
- 建议 job 超时 30 分钟（三次前端构建占大头）；验收本身在构建完成后约十几秒。
- 失败诊断依赖 stdout：失败输出已含步骤、请求、期望/实际状态与后端日志尾部，临时目录仍按约定清理。
- 本地发布命令保持单一入口：`verify-framework.ps1 -IncludeAcceptance`。

## 10. 测试策略

1. 先写 `scripts/acceptance/tests/test_runner.py` 的失败测试：
   - `allocate_port()` 返回可再次绑定的空闲端口；
   - `build_env()` 会前置 `PYTHONPATH` 且包含 `code4-shared/src`；
   - `request_json()` 对 200/201/409/503 与非 JSON 响应给出可读结果；
   - `StepFailure` 的格式化包含步骤名、URL、期望/实际状态。
2. 实现最小逻辑使自测通过。
3. 以 `scripts/verify-acceptance.ps1` 的真实运行作为集成验收：20 个检查全部 PASS。
4. 故障路径人工确认一次：临时改错一个期望（或占用/杀进程）应得到明确失败与退出码 1，然后还原。

## 11. 文档更新

- `README.md` 验证章节：增加 `-IncludeAcceptance` 与直接运行 `verify-acceptance.ps1` 的命令；
- `AGENTS.md` 验证命令：补充发布门禁命令与验收脚本位置；
- `docs/architecture.md`：在验证/数据流说明中注明「真实后端 + 临时库 + 重启持久化」的自动化验收层；
- `docs/progress.md`：新增本次切片章节，记录检查项与实测结果；
- `HANDOVER.md`：更新剩余欠账，区分「自动化已覆盖」与「仍需人工联调」。

## 12. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 动态端口分配存在竞态 | 端口只用于本机短生命周期进程；分配后立即启动，失败时明确报端口占用 |
| Windows 上进程终止不彻底 | `terminate` → 等待 10 秒 → `kill`；`finally` 兜底 |
| uvicorn 启动慢导致误判 | 20 秒健康窗口 + 进程存活检查 |
| SQLite 文件锁 | 重启前等待进程完全退出；每次运行独立临时库 |
| 验收依赖本机 Python 环境 | 复用 `resolve-python.ps1`；缺失时给出明确错误，不静默跳过 |
| 改动既有 verify-framework 行为 | 采用显式开关，默认路径零变化 |

## 13. 决策记录

- 选择方案 A：Python 标准库编排器 + PowerShell 入口。
- `-IncludeAcceptance` 为可选开关而非默认开启：保护既有脚本契约与既有 PowerShell 测试；发布时显式加开关即为门禁。
- 验收只做 API 层：前端由 Vitest + build/type-check 覆盖，避免引入浏览器驱动与新的不稳定源。
- 不验证课程视频上传：multipart 标准库实现成本高、与本次「真实链路持久化」目标无关。
- 监护人端只验证诚实的 503：健康数据源属于被禁/未接入能力，验收必须证明它没有伪造成功。
