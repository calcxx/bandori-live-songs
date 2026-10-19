# 部署指南

本文档面向自托管部署，覆盖数据库初始化、环境变量与首次上线。

## 前置条件

- Node.js 22（至少 22.13；版本提示见 `.nvmrc`）
- PostgreSQL 数据库（Supabase、Railway、自建等均可）
- 可访问 Eventernote 的网络环境

## 1. 克隆与安装

```bash
git clone <your-repo-url>
cd bdr-events-to-songs
cp .env.example .env.local
nvm use
npm ci
```

## 2. 配置环境变量

在 `.env.local` 中填写：

```env
DATABASE_URL=postgres://...
DIRECT_URL=postgres://...
SETLIST_IMPORT_KEY=<随机长字符串>
CRON_SECRET=<随机长字符串>
DEMO_USER_ID=
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

- `DATABASE_URL`：应用运行时连接，推荐使用连接池。
- `DIRECT_URL`：执行 `db:migrate` / `db:seed` 时使用；本地开发可与 `DATABASE_URL` 相同。
- `SETLIST_IMPORT_KEY`：管理后台登录密钥，自行生成足够长的随机字符串。
- `CRON_SECRET`：调用 `/api/cron/event-ranking` 与 `/api/cron/songs-sync` 时需在
  `Authorization: Bearer <secret>` 中携带。
- `DEMO_USER_ID`：可选；设置后首页展示该用户的示例数据，未设置时仅显示搜索框。
- `NEXT_PUBLIC_SITE_URL`：站点公开地址，用于生成 `sitemap.xml` 与 `robots.txt`；本地可使用 `http://localhost:3000`。

## 3. 初始化数据库

```bash
npm run db:migrate
npm run db:seed
```

`db:seed` 会写入乐队领域配置，并导入仓库中的空曲库与空活动规则模板。开源仓库不附带
生产歌曲、活动或 Setlist 数据；首次启动后需通过管理后台或自备导入流程填充。

## 4. 本地验证

```bash
npm run dev
```

访问 `http://localhost:3000`，输入 Eventernote 用户 ID 测试查询。

## 5. 生产构建

任意支持 Node.js 的平台均可部署（Docker、PM2、systemd 等）：

```bash
npm run build
npm run start
```

确保生产环境已注入上述环境变量。

## 6. 定时任务

项目包含两条每日定时任务：

| 接口 | 用途 | 建议时间（UTC） |
|---|---|---|
| `/api/cron/event-ranking` | 刷新各乐队演员页活动索引 | `16:00` |
| `/api/cron/songs-sync` | 从 MusicBrainz 最近 30 天记录补充新歌并修正更早发售日 | `17:00` |

活动索引的演员页请求使用 `limit=1000` 单页抓取，超过单页容量时继续分页；RAISE A SUILEN 会额外抓取 THE THIRD(仮) 的演员来源。用户统计的 Eventernote 抓取策略见[架构说明](../ARCHITECTURE.md)。

使用系统 cron、GitHub Actions 或云平台调度器请求：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/event-ranking
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/songs-sync
```

建议每天各执行一次，并错开调用时间。未配置 `CRON_SECRET` 时，两条接口仅在非生产环境允许匿名访问。
本开源仓库不绑定具体托管平台，请在所选平台配置等效调度任务。

`songs-sync` 支持 `?dryRun=1` 预览；同步部分失败时仍会返回已写入的结果，但 HTTP 状态为 `502`，调度器应据此告警。接口执行上限为 300 秒，内部抓取预算为 240 秒。

需要补录历史窗口时，可在具备数据库环境变量的机器上运行：

```bash
npx tsx scripts/sync-recent-songs.ts --since=2026-08-15
npx tsx scripts/sync-recent-songs.ts --since=2026-08-15 --apply
```

第一条命令只预览，第二条才写入；脚本会把完整决策报告保存到临时目录，并在部分失败时以非零状态退出。

## 7. 后续维护

### 更新曲目库

通过管理页 `/admin/songs-import` 手动添加歌曲，导入自行维护的 catalog，或启用
`/api/cron/songs-sync` 增量同步最近 30 天的歌曲。同步会跳过视频、无效日期和标注为翻唱的录音；
需要补录更早窗口时使用 `scripts/sync-recent-songs.ts --since=YYYY-MM-DD`。
翻唱曲与企划共通歌曲可通过 `/admin/songs-import` 单独维护；自动导入不会删除这些手工记录。

### 从旧版本升级

本次更新增加歌曲分类与 Setlist 歌曲外键。更新代码后先执行：

```bash
npm run db:migrate
```

迁移会保留原歌曲数据，将既有歌曲视为原创曲，并按可唯一匹配的曲名回填 Setlist 的歌曲 ID。
建议在执行迁移前按数据库平台的方式创建备份。

### Schema 变更

修改 `src/lib/db/schema.ts` 后：

```bash
npm run db:generate   # 生成新迁移
npm run db:migrate    # 应用到数据库
```

### 常用数据脚本

见 `package.json` 中 `data:*` 与 `db:*` 脚本。

## 8. 故障排查

| 现象 | 可能原因 |
|------|----------|
| 管理页无法登录 | `SETLIST_IMPORT_KEY` 未设置或与输入不一致 |
| 查询一直 warming | 数据库未 seed，或 Eventernote 抓取超时 |
| 迁移失败 | `DIRECT_URL` 不可达或权限不足 |
| Cron 返回 401 | `CRON_SECRET` 与请求头不匹配 |

## 相关文件

- [README.md](../README.md)
- [.env.example](../.env.example)
- [drizzle.config.ts](../drizzle.config.ts)
- [src/lib/db/schema.ts](../src/lib/db/schema.ts)
- [scripts/seed-all.ts](../scripts/seed-all.ts)
