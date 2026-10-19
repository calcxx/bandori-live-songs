# BanG Dream! 现场听歌统计

输入 [Eventernote](https://www.eventernote.com/) 用户名，即可查看自己参加过的
BanG Dream! 现场、各乐队原创曲听歌进度，以及尚未在现场听到的歌曲；也可以直接搜索
已收录活动的 Setlist。

> 本仓库是项目的开源分支。
> 欢迎通过 [Issue](https://github.com/calcxx/bandori-live-songs/issues) 反馈问题。线上站点的改动可能不会立即同步至此。

## 功能亮点

- 按乐队统计原创曲覆盖率，筛选未听歌曲、虚拟团与无歌曲活动
- 在用户统计与独立歌曲统计页中查看演唱次数、最近演唱日期、发售日期和对应场次
- 按 Eventernote 活动 ID 或标题模糊搜索 Setlist，并生成可分享的活动链接
- 支持独立的用户/活动路径、活动日期和乐队别名搜索，以及最近活动、系列活动与“历史上的今天”导航
- 可在完整曲库中检索歌曲，管理后台支持维护乐队搜索别名及删除未被引用的歌曲
- 展示每场活动的 Setlist 收录状态、首次演唱标记与首次听到的歌曲
- 曲库支持原创曲、翻唱曲与企划共通歌曲，Setlist 条目绑定明确的歌曲记录
- 通过 Eventernote 演员页活动索引识别活动归属，减少列表页出演者错位影响
- 支持简体中文、繁体中文、日语和英语
- 支持浅色、深色及跟随系统主题，并可将用户统计或单场歌单保存为 JPEG
- Eventernote 用户数据使用数据库缓存，并在过期时后台静默刷新
- 管理后台支持活动浏览、Setlist/歌曲导入与编辑、持久化列表筛选、屏蔽规则及用户缓存查看
- 可选的每日 MusicBrainz 同步会以最近 30 天为窗口补充新歌并修正更早的发售日期
- 提供带 OpenAPI 规范的版本化公开数据 API

## 工作原理

```mermaid
flowchart LR
  EN["Eventernote<br/>用户活动 / ICS"] --> App["Next.js 应用"]
  Index["演员页活动索引"] --> App
  DB[("PostgreSQL<br/>曲库 + Setlist")] --> App
  MB["MusicBrainz<br/>可选定时同步"] --> DB
  App --> UI["歌曲进度 / Setlist 搜索 / 图片导出"]
  App --> API["开放 API / OpenAPI"]
```

Eventernote 提供用户参加过的活动；本地数据库维护 BanG Dream! 曲库与人工录入的
Setlist。只有已收录 Setlist 的活动才会计入「听过」，听歌覆盖率仍只统计原创曲。
详细设计见
[ARCHITECTURE.md](ARCHITECTURE.md)。

开源仓库不附带生产歌曲、活动或 Setlist 数据，也不包含用户反馈、缓存导出或按活动 ID 定制的屏蔽数据。初始化后的曲库与活动规则为空，需通过管理后台
或自行准备的数据导入流程填充；乐队及外部服务标识作为应用运行所需的公开领域配置保留。

## 开放 API

运行后访问 `/api` 查看接口说明，或从 `/api/openapi.json` 获取 OpenAPI 规范。
版本化接口以 `/api/v1` 为根路径，提供乐队、歌曲、活动、歌曲演出场次及完整 Setlist 数据。

## 快速开始

需要 Node.js 22（至少 22.13；版本提示见 `.nvmrc`）与 PostgreSQL：

```bash
nvm use
cp .env.example .env.local
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

打开 `http://localhost:3000`。完整的首次部署、定时任务和故障排查说明见
[docs/deployment.md](docs/deployment.md)。

## 配置

| 环境变量               | 用途                       |     必需     |
| ---------------------- | -------------------------- | :----------: |
| `DATABASE_URL`       | 应用运行时数据库连接       |      是      |
| `DIRECT_URL`         | 迁移与数据脚本使用的直连   |      是      |
| `SETLIST_IMPORT_KEY` | 管理后台密钥               |      是      |
| `CRON_SECRET`        | 保护两条定时任务接口       | 生产环境建议 |
| `DEMO_USER_ID`       | 首页未查询时展示的示例用户 |      否      |
| `NEXT_PUBLIC_SITE_URL` | Sitemap 与 robots 使用的公开站点地址 | 否 |

常用检查：

```bash
npm run check
npm run build
npm run test:e2e
```

测试分层与运行边界见 [docs/testing.md](docs/testing.md)。

## 你也许感兴趣的项目

### Eventernote

- [Eventernote Receipt](https://receipt.gyuni.space/)
- [Eventernote Analyzer](https://en-analyzer.2ak1.com/)

### BanG Dream!

- [现地攻略导航](https://genchi.top/)
- [邦多利资料库](https://bandori.fans/)


## 许可证

[MIT](LICENSE)
