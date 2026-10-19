# 测试说明

本文说明当前开源仓库的测试分层、运行方式和边界，不记录阶段性的通过数量。

## 测试分层

| 层级 | 位置与配置 | 验证内容 | 外部依赖 |
| --- | --- | --- | --- |
| 单元与模块协作 | `tests/`、`vitest.config.mts` | 解析、业务规则、缓存、输入校验、鉴权、搜索、统计和 API 协作 | 网络/数据库边界由替身提供 |
| 浏览器 | `e2e/`、`playwright.config.ts` | 页面交互、路由状态、失败恢复和图片下载 | Chromium；启动本地 Next.js，API 使用夹具 |

本仓库不包含连接真实数据库的集成测试。需要验证 SQL 时，请在独立测试数据库中自行运行迁移和针对性查询。

## 本地检查

使用 `.nvmrc` 对应的 Node 22，并安装锁文件中的依赖：

```bash
npm ci
npm run check
npm run build
```

`check` 依次执行零警告 ESLint、`next typegen` / TypeScript 和 Vitest。自动生成的 `next-env.d.ts` 不纳入版本控制，首次类型检查不依赖预先启动开发服务器。

可单独执行：

```bash
npm test
npm run lint
npm run typecheck
npm run test:watch
```

## 单元与模块协作测试

重点测试及其边界：

- `song-lookup.test.ts`、`song-seed-import.test.ts`：精确标题、唯一规范化标题、歧义及种子导入时的分类冲突保护。
- `get-user-song-stats.test.ts`、`user-events-refresh.test.ts`：统计入口的新旧缓存转换、失败分流、请求复用、摘要传递和取得租约后才抓取；数据库替身不能证明真实跨进程互斥。
- `eventernote-calendar.test.ts`：数字用户 ID 提取、ICS 解析、活动数不超过 300 时走 ICS、超过 300 时走 `limit=2000` HTML，以及 ICS/大页失败时的回退。
- `eventernote.test.ts`、`eventernote-actor-events.test.ts`：分页、超时预算；演员页使用 `limit=1000` 的单页请求。
- `additional-actor-events.test.ts`：THE THIRD(仮) 作为 RAISE A SUILEN 的附加演员来源、共享活动去重及抓取失败时不替换索引。
- `musicbrainz-recent-songs-sync.test.ts`、`musicbrainz-sync-network.test.ts`：30 天默认窗口、翻唱过滤（含 MusicBrainz 作品关系）、分页截断、重试和抓取预算。
- `songs-sync-route.test.ts`：cron 鉴权、部分失败时的 502 状态及缓存失效。
- `home-requests.test.ts`、`home-user-stats-cache.test.ts`：浏览器请求复用、失败重试、会话恢复、大小写无关用户键和缓存淘汰。
- `fetch-with-timeout.test.ts`：虚拟时钟验证请求与正文的共同超时、网络失败及调用方取消。
- `event-ranking-snapshot.test.ts`：真实 Drizzle 查询构造器配合模拟驱动，验证 SQL 结构及结果映射；不等同于执行真实 SQL。
- `cron-cache-invalidation.test.ts`：鉴权、成功/失败、dry run、无变化及写入后的失效标签；不执行正式 cron。
- 其他解析样本、日期、歌曲分类、多语言、可见性、活动筛选、Spotify 和开放 API 用例均通过实际业务函数验证边界。

仅因某函数有测试不能证明它仍被产品使用。删除已停用功能时，同时删除专属测试；共享业务规则的回归测试保留在实际调用入口。

## 浏览器测试

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright 启动 `127.0.0.1:3000` 的 Next.js 开发服务器，并清空 `DATABASE_URL` / `DIRECT_URL`。本地允许复用已启动服务器；如需保证测试使用隔离配置，先停止占用 3000 端口的服务，或使用 `CI=1 npm run test:e2e` 禁止复用。

- `home.spec.ts`：固定简体中文，验证空输入、非法输入和合法输入恢复；模拟示例统计不可用。
- `live-search.spec.ts`：固定 API 数据，验证活动搜索、详情、用户/活动标签切换、清空、请求失败后的重试，以及歌单图片下载（检查建议文件名，不校验图片内容）；同时检查未捕获浏览器异常。

失败时保存 trace 与截图到 `test-results/`。用例不会提交有效用户查询或管理员写入；真实 Eventernote 抓取、后台提交和正式 cron 仍需在独立环境验证。

## 持续集成

[Checks 工作流](../.github/workflows/checks.yml) 在推送 `main` 和 Pull Request 时执行：

1. 按 `.nvmrc` 设置 Node，`npm ci` 安装依赖。
2. `npm run check` 与 `npm run build`。
3. `npm audit --audit-level=high` 检查全量依赖的高风险及以上漏洞。
4. `npm audit --omit=dev` 检查生产依赖的全部已报告漏洞。
5. 安装 Chromium 及系统依赖，运行浏览器测试。

工作流只有仓库读取权限，不使用数据库或管理密钥。
