# BanG Dream! 现场听歌统计站

基于 Next.js App Router、Postgres 和 Drizzle 的单页工具站。输入 [Eventernote](https://www.eventernote.com) 用户 ID，统计 BanG Dream! 现场歌曲覆盖情况。

架构说明见 [ARCHITECTURE.md](ARCHITECTURE.md)，部署指南见 [docs/deployment.md](docs/deployment.md)。

## 开发

```bash
cp .env.example .env.local   # 填写数据库连接与管理密钥
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

可选：设置 `DEMO_USER_ID` 后，首页会展示该 Eventernote 用户的示例数据；未设置时仅显示搜索框。

## 常用脚本

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:seed` 会从仓库内置的 `src/data/discography-catalog.json` 导入曲目库。新增歌曲请使用管理页 `/admin/songs-import`；Setlist 通过 `/admin/setlist-import` 维护。

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | 运行时数据库连接（推荐连接池） |
| `DIRECT_URL` | 迁移与 seed 使用的直连（可与 `DATABASE_URL` 相同） |
| `SETLIST_IMPORT_KEY` | 管理页 `/admin/*` 鉴权密钥 |
| `CRON_SECRET` | 保护 `/api/cron/event-ranking` 的 Bearer token |
| `DEMO_USER_ID` | 可选；首页示例展示的 Eventernote 用户 ID |

## 友链

- [Eventernote 年度总结](https://receipt.gyuni.space/) — 本项目的灵感来源
- [日本 live 远征攻略导航](https://genchi.top/)（Sallyn）
- [邦多利资料库](https://bandori.fans/)（北美炸梦同好会）

## 许可证

[MIT](LICENSE)
