# lorekit fetchers

底层抓取后端。由 `wiki fetch <url>` 子命令根据 URL host 路由调用，**不直接对外**。

## 面向 agent / user

用 `wiki fetch`，不用直接调这里的脚本：

```bash
wiki fetch https://mp.weixin.qq.com/s/xxx
# → 单行 JSON：{"status":"ok","route":"rich","markdown":"...","images_dir":"...",...}
```

产物自动落在：
- corpus 内 → `<corpus>/_工作台/00_收件/fetch/<slug>/`
- corpus 外 → `/tmp/lorekit-fetch/<slug>/`（兜底）

`wiki fetch --help` 看完整选项。

## 面向贡献者

### 依赖

| 工具 | 必填 | 用途 |
|---|---|---|
| [uv](https://docs.astral.sh/uv/) | ✓ | `fetch_rich.py` 通过 `uv run --script` 启动，自动管理 Python 依赖到临时环境，**不污染系统 Python** |
| Python 3.11+ | ✓ | uv 自己装 |
| Playwright（system python） | 可选 | L2 降级（Chromium 无头抓反爬站）。没装的话反爬站点会直接报 `ANTIBOT_BLOCKED` |

**macOS 安装**：
```bash
brew install uv

# 可选：装 Playwright 启用 L2 降级
pip install playwright && playwright install chromium
```

### 文件清单

```
bin/fetchers/
├── README.md          本文件
├── fetch_rich.py      ~450 行主脚本，PEP 723 script metadata 自管理依赖
└── fetch_rich_l2.py   ~60 行 Playwright 降级（被 fetch_rich.py 子进程调用）
```

### fetch_rich.py 内部分层

- **L1**: httpx + iPhone UA 直抓，70-80% 微信公众号命中
- **L2**: 通过子进程调 `fetch_rich_l2.py`，用 system python + Playwright Chromium 无头渲染（L1 失败或 `--l2-only` 时触发）
- 解析正文后抽 `<img>` 列表（处理 `data-src` 懒加载）
- 并发下载所有图片，改写 markdown 里的 img 引用为本地相对路径 `./images/img_NN.jpg`

### stdout 契约

成功：
```
title: 文章标题
author: 作者
source: L1          # or L2
images: 12 ok, 0 too_large, 1 failed
markdown: /path/to/slug/article.md
images_dir: /path/to/slug/images
OK fetch-rich
```

失败最后一行：
- `ANTIBOT_BLOCKED` — L1+L2 都过不去
- `ERROR <reason>` — 其它错误

`bin/lib/fetch.sh` 解析这些行转成 `wiki fetch` 的 JSON 输出。

### 命令行选项

```bash
fetch_rich.py <URL>              # 默认：L1→L2 自动，下载图片
fetch_rich.py <URL> --no-images  # 只要正文，不下图
fetch_rich.py <URL> --l2-only    # 跳过 L1 直接走 Playwright（调试用）
fetch_rich.py <URL> --out <DIR>  # 指定产物的父目录（默认 /tmp/fetch-rich）
```

## 路由表（由 wiki fetch 决定）

| URL host | 路由 | 后端 | 今晚实现 |
|---|---|---|---|
| `mp.weixin.qq.com` | `rich` | `fetch_rich.py` | ✅ |
| 一般网页 / 博客 | `rich` | `fetch_rich.py`（通用 mode） | ✅ |
| `feishu.cn`、`larkoffice.com` | `lark` | 返回 `suggest: lark-cli docs +read` | ✅ 仅 suggest |
| `x.com`、`twitter.com` | `x` | 返回 `suggest: paste screenshot` | ✅ 仅 suggest |
| `github.com`、`gist.github.com` | `github` | 返回 `suggest: WebFetch` | ✅ 仅 suggest |
| `*.pdf` | `pdf` | 返回 `suggest: pdf skill` | ✅ 仅 suggest |

"仅 suggest" 的意思是 `wiki fetch` 只返回一个建议 JSON，不真抓——agent 按 `suggest` 字段自己调对应工具。未来 v0.5+ 可能把 lark / pdf 的 shell out 也填实。

## 已知限制

- **X/Twitter/Cloudflare 站**：L2 Playwright 指纹不够狠，过不去
- **SPA 站**（Notion 公开页）：可能空正文
- **图片 hotlink 保护**：带 Referer 仍 403 的会标记 failed
- **视频/音频卡片**：直接丢弃，只处理 `<img>`
- **网络抖动**：L1 SSL 错误会自动降级 L2；若 L2 也没装就报 `ANTIBOT_BLOCKED`

## 未来

- v0.5+：X / Twitter 后端（更强反指纹）
- v0.5+：`github-content-fetch` 整合
- v0.5+：RSS / Atom 批量摄入
- v1.0+：可插拔 fetcher 接口（类似 v0.5 向量层的 provider 模式），第三方 fetcher 可注册到路由表
