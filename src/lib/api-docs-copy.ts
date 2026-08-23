import type { Locale } from "@/lib/i18n";

const copy = {
  "zh-cn": {
    title: "开放 API",
    description:
      "通过只读 JSON 接口获取本站维护的乐队、歌曲、活动和歌单数据。",
    quickStart: "快速开始",
    endpoints: "接口",
    endpointDescription: "用途",
    notes: "使用说明",
    notesBody:
      "接口无需密钥并允许跨域读取。歌曲和活动列表默认返回 500 条，单次最多 1000 条；如有下一页，请继续使用响应中的 nextCursor。服务按现状提供，不承诺可用性 SLA。",
    bands: "获取全部乐队",
    songs: "检索歌曲和分类",
    events: "检索已有歌单的活动",
    eventDetail: "获取单场活动及完整歌单",
    songEvents: "获取歌曲对应的演出活动",
    openapi: "OpenAPI 规范",
    response: "响应示例",
  },
  "zh-tw": {
    title: "開放 API",
    description:
      "透過唯讀 JSON 介面取得本站維護的樂團、歌曲、活動與歌單資料。",
    quickStart: "快速開始",
    endpoints: "介面",
    endpointDescription: "用途",
    notes: "使用說明",
    notesBody:
      "介面不需金鑰並允許跨網域讀取。歌曲與活動清單預設回傳 500 筆，單次最多 1000 筆；若有下一頁，請繼續使用回應中的 nextCursor。服務依現況提供，不承諾可用性 SLA。",
    bands: "取得全部樂團",
    songs: "搜尋歌曲與分類",
    events: "搜尋已有歌單的活動",
    eventDetail: "取得單場活動與完整歌單",
    songEvents: "取得歌曲對應的演出活動",
    openapi: "OpenAPI 規格",
    response: "回應範例",
  },
  ja: {
    title: "オープン API",
    description:
      "本サイトが管理するバンド、楽曲、イベント、セットリストを読み取り専用 JSON API で取得できます。",
    quickStart: "クイックスタート",
    endpoints: "エンドポイント",
    endpointDescription: "用途",
    notes: "利用上の注意",
    notesBody:
      "API キーは不要で、クロスオリジンからも取得できます。楽曲とイベントの一覧は既定で 500 件、最大 1000 件です。次ページがある場合は、レスポンスの nextCursor を使用してください。本サービスは現状有姿で提供し、可用性 SLA は設けていません。",
    bands: "バンド一覧を取得",
    songs: "楽曲とカテゴリを検索",
    events: "セットリスト登録済みイベントを検索",
    eventDetail: "イベントとセットリスト全体を取得",
    songEvents: "楽曲が披露されたイベントを取得",
    openapi: "OpenAPI 定義",
    response: "レスポンス例",
  },
  en: {
    title: "Open API",
    description:
      "Access the bands, songs, events, and setlists maintained by this site through a read-only JSON API.",
    quickStart: "Quick Start",
    endpoints: "Endpoint",
    endpointDescription: "Purpose",
    notes: "Usage Notes",
    notesBody:
      "No API key is required, and cross-origin requests are allowed. Song and event lists return 500 items by default, with a maximum of 1,000 per request. When another page is available, continue with the nextCursor value from the response. The service is provided as is, with no availability SLA.",
    bands: "List all bands",
    songs: "Search songs and categories",
    events: "Search events with recorded setlists",
    eventDetail: "Get an event and its complete setlist",
    songEvents: "Get events where a song was performed",
    openapi: "OpenAPI specification",
    response: "Example Response",
  },
} as const;

export function getApiDocsCopy(locale: Locale) {
  return copy[locale];
}
