# Kibarkan Bendera: Kata Arah · 交接

## 目前做到哪
子代理已实作完成（2026-10-14）：index/styles/app/scenes、素材（make-assets.py）、音档 133 句、test-e2e.py、test-mobile.py 全过。未 commit、未部署，等主对话验收。

## 待老师核对
- 课本第 2 句「Nani berdiri (di) ___ Sin Ling」答案 belakang 是按图推断，空格前有无 di、人名牌看不清，待核对课本原页。

## 已知问题
- Zali 正面造型原本举国旗：已在 make-assets.py 抠掉旗面与旗杆，握拳里还留一小段杆身（无国旗）。
- 排队关（Tahap 3）第一位放对后会轻轻滑进跑道（避免被群众挡住后面的人）。
- 本机测试：`python3 -m http.server 8793 --bind 127.0.0.1`；gen-voice／测试都用 8793。

## 最后更新
2026-10-14
