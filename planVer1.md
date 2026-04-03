# Kế hoạch Fix Lỗi - Ver 1

## Danh sách lỗi cần fix

| # | Lỗi | Nguyên nhân gốc | Trạng thái |
|---|-----|----------------|------------|
| 1 | Combo 2: User A không thấy lá cướp được là gì | `resolvePendingAction` COMBO_2 ghi `theftEvent` nhưng không trigger `showStolenCardPopup` cho user A | ⏳ Chờ |
| 2 | Combo 2: Phải chọn target + lá 2 lần | `showPendingActionPopup` gọi lại `askCombo2Target()` mỗi khi state sync sau khi action đã được commit | ⏳ Chờ |
| 3 | Streaking Kitten: Bảo vệ bom thứ 2 (sai luật) | `drawCard` chỉ kiểm tra `hand.some(STREAKING_KITTEN)` mà không đếm số bomb đang giữ vs số Streaking | ⏳ Chờ |
| 4 | Mobile: Bốc bài + đống bài đã đánh nằm riêng hàng | Layout `grid-cols-1 md:grid-cols-3` khiến mobile xuống hàng, cần đặt 2 pile cùng 1 hàng + logs xuống | ⏳ Chờ |
| 5 | FAVOR: User B không thấy nhận được lá gì | `completeFavor` không set `theftEvent` / không có popup cho user B | ⏳ Chờ |
| 6 | Không thể kéo-thả sắp xếp bài tay | Chưa có drag-and-drop, chỉ có nút "Sắp Xếp Bài" tự động | ⏳ Chờ |
| 7 | NOPE: Thời gian không reset về 8s, không thông báo ai nope ai | `playNope` reset `endTime = Date.now() + 5000` (5s) và không log tên người bị nope | ⏳ Chờ |
| 8 | Rút đáy (DRAW_FROM_BOTTOM): Thông báo lộ lá rút được | `showDrawnCardPopup` được gọi ở `drawCard` nhưng không lọc DRAW_FROM_BOTTOM; trong `resolvePendingAction` DRAW_FROM_BOTTOM không ẩn tên lá | ⏳ Chờ |

---

## Chi tiết phân tích & giải pháp

### Bug 1 — Combo 2: User A không thấy lá cướp được
- **Root cause**: `resolvePendingAction` case `COMBO_2` set `roomUpdate.theftEvent` đúng cho victim, nhưng không có cơ chế nào hiện popup cho ngườ chơi A (kẻ cướp).
- **Fix**: Sau khi `resolvePendingAction` xử lý xong COMBO_2, gọi `showStolenCardPopup(stolen, victim.name)` ngay trên client nếu `isMeAction`.

### Bug 2 — Combo 2: Hiện form chọn target 2 lần
- **Root cause**: `showPendingActionPopup` được gọi từ `renderGame` khi `pendingAction` còn tồn tại. Sau khi user A đã `commitCombo2` → `initiateAction` đặt `pendingAction.type = COMBO_2` lên Firestore → khi state sync về, `showPendingActionPopup` kiểm tra `isMe && isModalAction` → gọi lại `askCombo2Target()` lần 2.
- **Fix**: Trong `showPendingActionPopup`, nếu `action.targetData` đã có đủ dữ liệu (targetId + cardIndex) thì không mở lại UI chọn. Hoặc thêm flag `pendingAction.confirmed = true` khi đã confirm xong.

### Bug 3 — Streaking Kitten bảo vệ sai
- **Root cause**: 
  ```js
  if (me.hand.some(c => (c.type || c) === 'STREAKING_KITTEN'))
  ```
  Chỉ check "có Streaking Kitten không?" chứ không đếm xem đang giữ bao nhiêu KITTEN trên tay.
- **Luật đúng**: Streaking Kitten chỉ cho phép ôm nhiều nhất 1 KITTEN trên tay không phát nổ. Nếu rút KITTEN thứ 2 khi đang giữ 1 KITTEN → phải nổ (cần DEFUSE).
- **Fix**: Kiểm tra `kittenCountInHand >= streakingKittenCount` → nếu bằng hoặc vượt thì không được miễn.

### Bug 4 — Mobile layout
- **Root cause**: 3 cột chỉ hiện trên md+, mobile thành stack dọc.
- **Fix**: Thay `grid-cols-1 md:grid-cols-3` bằng layout linh hoạt: hàng 1 = draw pile + discard pile (flex row); hàng 2 = game logs.

### Bug 5 — FAVOR: Không thông báo cho User B
- **Root cause**: `completeFavor` không set `theftEvent` và không có popup.
- **Fix**: Sau `completeFavor` set `theftEvent = { victimUid: thiefId, thiefName: victimName, cardType, ... }` để thief thấy, và set `favorReceivedEvent` để victim thấy.

### Bug 6 — Drag-and-drop sắp xếp bài
- **Root cause**: Chưa implement.
- **Fix**: Dùng HTML5 Drag-and-Drop API (không cần thư viện), lưu thứ tự vào Firestore khi drop.

### Bug 7 — NOPE reset timer & broadcast
- **Root cause**: `playNope` set `endTime = Date.now() + 5000` (5s) thay vì 8s, và log chỉ ghi "ai đó ném nope" mà không nói bị nope vào của ai.
- **Fix**: Reset về 8s, log rõ `${noper.name} ném NOPE chặn ${action player name}!`.

### Bug 8 — DRAW_FROM_BOTTOM lộ lá
- **Root cause**: `resolvePendingAction` case `DRAW_FROM_BOTTOM` push `bottomCard` vào tay nhưng không cho user biết rút được gì — đây không phải bug, đây là đúng bên server. Tuy nhiên log ghi `[DRAW] rút 1 lá bài` lộ thông tin nếu có popup.
- **Fix**: Không gọi `showDrawnCardPopup` cho DRAW_FROM_BOTTOM; chỉ thông báo "Bạn đã rút lá từ đáy" mà không tiết lộ tên lá.

---

## Tiến độ thực thi

- [x] Bug 1 — Combo 2 feedback cho A → `resolvePendingAction` COMBO_2 gọi `showStolenCardPopup` nếu `isMeAction`
- [x] Bug 2 — Combo 2 double UI → `showPendingActionPopup` kiểm tra `action.confirmed` + `targetData.cardIndex` trước khi mở UI; `commitCombo2` gửi `confirmed: true` trong targetData
- [x] Bug 3 — Streaking Kitten logic → `drawCard` đếm số KITTEN đang giữ so với số STREAKING_KITTEN để quyết định có bảo vệ không
- [x] Bug 4 — Mobile layout → Thay `grid-cols-1 md:grid-cols-3` bằng flex row cho draw + discard pile; logs xuống hàng dưới
- [x] Bug 5 — FAVOR notify receiver → `completeFavor` set `theftEvent.isFavor = true + thiefUid`; `enterRoom` snapshot handler xử lý và gọi `showStolenCardPopup` cho thief
- [x] Bug 6 — Drag-and-drop hand → HTML5 drag events (`dragstart/dragover/drop/dragend`) trên mỗi card; drop cập nhật thứ tự tay bài lên Firestore; CSS `cursor: grab`
- [x] Bug 7 — NOPE timer + broadcast → `playNope` reset `endTime = Date.now() + 8000`; log ghi rõ tên người bị nope và tên người nope
- [x] Bug 8 — Draw From Bottom ẩn tên lá → `resolvePendingAction` DRAW_FROM_BOTTOM gọi `showDrawnCardPopup` CHỈ cho `isMeAction`; log chỉ ghi "rút 1 lá từ đáy nọc" không tiết lộ tên
