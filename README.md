# Gitub Analysis for You

## 線上網站

[https://gitub-analysis-for-you.onrender.com/](https://gitub-analysis-for-you.onrender.com/)

## 如何啟動伺服器

在 `cmd` 裡輸入：

```bat
C:\githubProject\start-server.bat
```

啟動後，打開：

[http://localhost:3000](http://localhost:3000)

## 部署到 Render

專案已包含 [render.yaml](C:\githubProject\render.yaml)，可直接部署到 Render。

部署重點：

- 啟動指令：`python server.py`
- 線上環境會使用專案內的 `data/tools.db`
- Render 會自動關閉本機資料庫同步功能，不會去讀你電腦裡的 Downloads 路徑
