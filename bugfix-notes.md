# Bugfix Notes — gameMeoNo (Exploding Kittens Clone)

> File này ghi lại tất cả các bug đã fix theo từng phase để tránh vô tình revert lại.

---

## Phase 1–7 (các session trước)

| Bug | Fix |
|-----|-----|
| rules.md + planVer1.md thiếu | Đã tạo tài liệu |
| NOPE popup không hiển thị | Sửa logic `showPendingActionPopup` |
| CLONE → FAVOR crash | Sửa `initiateAction` clone detection |
| DRAW_FROM_BOTTOM popup timing | Dùng `drawFromBottomCard` local var (sau đổi sang Firestore event) |
| COMBO notifs thiếu | Thêm log cho COMBO_2/3/5 |
| Firestore 400 error | `logs.slice(-50)` ở 7 chỗ trong codebase |
| Shuffle animation chặn UI | Thêm `shuffle-overlay` div với `pointer-events: all` |
| Defuse race condition | `defusingResolved` semaphore; check trước `clearInterval` |
| Game-over overlay không xóa | `renderGame` remove overlay khi `status !== 'finished'` |
| Play Again feature | `playAgain()` reset Firestore về `waiting` state |

---

## Phase 8 (April 2025)

### 1. STREAKING_KITTEN đổi tên
- **File:** `CARD_TYPES` object (~line 306)
- **Fix:** `name: 'Mèo Quần Xì'` (từ 'Mèo Chạy Rông')

### 2. Combo 2/3 + FAVOR + TARGETED_ATTACK thiếu tên target trong popup
- **File:** `showPendingActionPopup` function
- **Fix:** Thêm biến `targetInfo` tra cứu `action.targetData.targetId` → hiển thị tên người bị nhắm trong popup NOPE

### 3. DRAW_FROM_BOTTOM popup không hiển thị cho người rút (non-host)
- **Root Cause:** Biến `drawFromBottomCard` local chỉ hoạt động khi host = người rút
- **Fix:** Dùng Firestore field `drawnFromBottomEvent: { playerUid, cardType, timestamp }` broadcast trong `resolvePendingAction`; `onSnapshot` phát hiện thay đổi và gọi `showDrawnCardPopup` cho đúng người

### 4. Countdown defuse vẫn chạy cho người khác sau khi người dính bom dùng DEFUSE
- **Root Cause:** `status` vẫn là `'defusing'` cho đến khi `completeDefuse` chạy xong (chọn vị trí bom)
- **Fix:** `playDefuseCard` cập nhật `status: 'placing_bomb'` + `defuseEndTime: null` ngay lập tức trước `askKittenPosition`
- **Guards cập nhật:**
  - `completeDefuse`: accept `status === 'placing_bomb'` hoặc `'defusing'`
  - `explodeTimeout`: accept `status === 'placing_bomb'` hoặc `'defusing'`
  - `renderGame`: clear `defusingInterval` khi status không phải `'defusing'`
  - `renderGame`: block `placing_bomb` mới → đóng defuse modal cho non-defusingPlayer users

### 5. Player đã chết vẫn thấy countdown defuse popup của người khác
- **Fix:** Cùng fix với #4 — `placing_bomb` status đóng modal ngay

### 6. Ván mới sau khi kết thúc vẫn hiện defuse popup
- **Fix:** `renderGame` xóa `defusingInterval` và đóng modal khi status != 'defusing'; game-over overlay bị xóa khi status != 'finished'
- **Thêm:** `playAgain()` reset thêm `drawnFromBottomEvent: null`

### 9. Bốc bom không có gỡ bom → chết → khởi động ván mới → defuse popup vẫn hiện
- **Root Cause:** `explodeTimeout` clear `defusingInterval` TRƯỚC khi write Firestore. `renderGame` thấy `defusingInterval = null` nên không trigger close modal.
- **Fix 1 (Phase 8):** `renderGame` check `finished || waiting` → đóng modal (KHÔNG ĐỦ vì không cover `playing`)
- **Fix 2 (Phase 9):** `renderGame` check `status !== 'defusing'` → cover tất cả trạng thái không phải defusing. `playAgain()` reset `defusingResolved = false`.
- **QUAN TRỌNG:** Không dùng `defusingInterval !== null` làm guard duy nhất để đóng modal.

### 7. TARGETED_ATTACK log thiếu tên target
- **File:** `resolvePendingAction` case `TARGETED_ATTACK`
- **Fix:** Log message dạng: `🎯 ${me.name} đâm lén ${players[tIdx].name}! ${players[tIdx].name} cần rút thêm 2 lượt!`

### 8. ATTACK/TARGETED_ATTACK stacking không cộng dồn đúng
- **Bug:** Khi player A đang có 3 lượt và chơi ATTACK → next player chỉ nhận 3 lượt (1+2) thay vì 5 lượt (3+2)
- **Root Cause:** `players[nextIdx].turnsToTake += 2` không dùng `me.turnsToTake`
- **Fix:** Lưu `attackerTurns = me.turnsToTake` TRƯỚC khi reset, sau đó `nextPlayer.turnsToTake = attackerTurns + 2`

### 10. CLONE sao chép sai lá bài
- **Root Cause:** `initiateAction` đọc `gameState.discardPile` (stale local state), có thể thấy lá cũ do Firestore write chưa propagate
- **Fix:** `const roomSnap = await roomRef.get(); const discardPile = roomSnap.data().discardPile || [];`

### 11. SKIP pass qua người tiếp theo thay vì trừ 1 lượt
- **Bug:** Khi có 3 lượt + dùng SKIP → pass luôn thay vì còn 2 lượt
- **Root Cause:** `case 'SKIP': me.turnsToTake = 1; advance` — luôn advance không kể số lượt còn lại
- **Fix:** `me.turnsToTake--; if (me.turnsToTake <= 0) { me.turnsToTake = 1; advance; }`

### 12. Gỡ bom mất thêm 1 lá thừa
- **Root Cause:** `showDefusingPopup` hardcode `defuseIdx = findIndex('DEFUSE')` vào onclick HTML button. Nếu hand thay đổi (Firestore snapshot) trước khi user bấm → index stale → splice nhầm lá khác.
- **Fix:** `playDefuseCard` luôn `findIndex('DEFUSE')` dynamically, không dùng parameter index.
- **QUAN TRỌNG:** Không hardcode card index vào HTML button onclick khi hand có thể thay đổi bất kỳ lúc nào.

### 13. Popup defuse vẫn hiện cho Thu/Nhu sau khi Thien nổ (game chưa kết thúc)
- **Root Cause:** Check cũ chỉ cover `finished/waiting`, không cover `playing` khi còn >1 người sống
- **Fix:** Thay `if (finished || waiting)` bằng `if (status !== 'defusing')` để cover tất cả

### 14. Popup NOPE countdown không hiện cho người đánh COMBO_2/TARGETED_ATTACK
- **Root Cause:** `showPendingActionPopup`: khi `isMe && isModalAction && alreadyConfirmed` → `return` ngay
- **Fix:** Restructure: `if (!alreadyConfirmed) { show target UI; return; }` → khi `alreadyConfirmed`, fall through → show NOPE countdown

### 15. Cải tiến: Mũi tên chiều vòng chơi
- **Thêm:** `<div id="direction-indicator">` trong HTML + update trong `renderGame`
- **Logic:** Iterate từ `currentTurn` theo `playDirection` → collect tên theo thứ tự → join " → " / " ← "
- **Hiển thị:** "Thứ tự: Thien → Nhu → Thu → ..." (tên mình in đậm trắng)

### 16. Đâm Lén/Favor: người đánh không thấy popup chờ NOPE
- **Bug:** Người bị nhắm thấy "ĐANG CHỜ NOPE", nhưng người đánh (action owner) không thấy nên không kịp phản-NOPE
- **Root Cause:** `pendingAction.confirmed` được tính theo rule cũ (chủ yếu cho COMBO_2), không phù hợp với `TARGETED_ATTACK/FAVOR/CURSE` chỉ cần `targetId`
- **Fix:** Trong `initiateAction`, tính `confirmed` theo từng loại action:
  - `COMBO_2`: cần `targetId + cardIndex`
  - `COMBO_3`: cần `targetId + requestedType`
  - `COMBO_5`: cần `requestedType`
  - `FAVOR/TARGETED_ATTACK/CURSE`: chỉ cần `targetId`
- **Kết quả:** Người đánh luôn thấy popup countdown NOPE đúng lúc để phản ứng.

### 17. Favor: người đánh vẫn thao tác được khi đang chờ cống nạp
- **Bug:** Sau khi đánh FAVOR và chọn target, người đánh vẫn có thể rút/đánh lá khác trong lúc target chưa cống nạp
- **Fix 1:** Khóa thao tác ở `drawCard` và `executePlay` nếu `gameState.favorRequest?.from === userId`
- **Fix 2:** Hiển thị modal trạng thái cho người đánh FAVOR: "ĐANG CHỜ CỐNG NẠP..."
- **Kết quả:** Luồng đúng: người đánh chờ target nộp lá, không thể đi tiếp lượt trái luật.

### 18. Đâm Lén: phía người đánh không chạy countdown (kẹt ở 8.0s)
- **Bug:** Sau khi chọn target cho `TARGETED_ATTACK`, cả 2 bên đều thấy popup NOPE nhưng phía người đánh (`action owner`) thanh thời gian đứng yên ở `8.0s`.
- **Root Cause:** `updatePendingActionPopup` có guard `if (isMe && isModalAction) return;` nên client người đánh không update `pending-bar-inner`/`pending-time-text`.
- **Fix:** Đổi guard thành `if (isMe && isModalAction && !action.confirmed) return;`
- **Ý nghĩa:** Chỉ bỏ qua update khi còn ở bước chọn mục tiêu. Khi đã `confirmed`, popup NOPE phải được update timer như mọi client khác.

---

## Cấu trúc quan trọng cần nhớ

### Status flow
```
waiting → playing → defusing → placing_bomb → playing (hoặc finished)
```

### Firestore broadcast fields (không phải game state thực)
- `drawnFromBottomEvent: { playerUid, cardType, timestamp }` — trigger popup cho người rút đáy
- `gameOverEvent: { winnerName, winnerUid, loserName, timestamp }` — trigger game-over overlay
- `theftEvent` — trigger theft popup cho victim COMBO_2/3
- `shuffling: { animating, startedAt }` — trigger shuffle animation overlay
- `actionResult: { type, playerUid, cards, timestamp }` — SEE_THE_FUTURE / ALTER_THE_FUTURE

### Semaphores / Race condition guards
- `defusingResolved` — chỉ cho `completeDefuse` hoặc `explodeTimeout` chạy 1 lần duy nhất
- `defusingInterval` — ref để clearInterval; KHÔNG dùng làm guard duy nhất để đóng modal

### Vị trí đặt bom (`completeDefuse`)
- `-2` = Đáy (`deck.unshift`)  
- `0`  = Trên cùng (`deck.push`)  
- `-1` = Ngẫu nhiên (`Math.random()`)  
- `n > 0` = Vị trí thứ n từ trên (`deck.splice(deck.length - n, 0, ...)`)

### turnsToTake logic
- Default = 1 (rút 1 lá, kết thúc lượt)
- ATTACK từ A → B: lưu `attackerTurns = A.turnsToTake` TRƯỚC, rồi `B.turnsToTake = attackerTurns + 2`, `A.turnsToTake = 1`
- Sau khi rút bài: `me.turnsToTake--; if (<=0) { reset=1; nextTurn }`
- SKIP: giảm `turnsToTake` như rút bài (không advance nếu còn lượt)

---

## Phase 9 (April 2026)

### 19. Gỡ bom bị trừ 2 lá DEFUSE
- **Bug:** Khi bốc bom và dùng Gỡ Bom, người chơi có thể mất 2 lá DEFUSE.
- **Root Cause:** DEFUSE bị `splice` ở cả `playDefuseCard` và `completeDefuse`.
- **Fix:** Chỉ trừ DEFUSE trong `playDefuseCard`; `completeDefuse` không trừ lại.

### 20. Combo 5 lá không chọn được lá trong mộ bài / game bị đứng
- **Bug:** Sau khi đánh 5 lá, popup chọn lá bị lỗi hoặc không thực thi.
- **Root Cause 1:** Đọc kiểu lá trong discard sai (giả định luôn là object có `.type`).
- **Root Cause 2:** Một số trường hợp thiếu `indexes` khi commit target của COMBO_5.
- **Fix:**
  - Normalize card type bằng `(c?.type || c)`.
  - Thêm guard `commitCombo5`: nếu thiếu 5 index hợp lệ thì báo lỗi và dừng an toàn.
  - Nếu `pendingAction` COMBO_5 đã tồn tại thì chỉ cập nhật `targetData` + `confirmed`.

### 21. Lời Nguyền Mù không tự hết sau khi rút/qua lượt
- **Bug:** Người bị nguyền vẫn bị úp bài dù đã rút bài hoặc dùng lá qua lượt.
- **Fix:** Reset `isBlind = false` khi:
  - `drawCard`
  - `SKIP`
  - `SUPER_SKIP`
  - `DRAW_FROM_BOTTOM`

### 22. Mộ bài cập nhật trễ/sai thứ tự (ảnh hưởng CLONE)
- **Bug:** Vừa đánh action nhưng mộ bài hiển thị lá cũ, CLONE có thể đọc sai action gần nhất.
- **Root Cause:** Dùng `firebase.firestore.FieldValue.arrayUnion` cho `discardPile` làm mất tính thứ tự ổn định và không phù hợp khi cần cho phép lá trùng.
- **Fix:** Chuyển sang append mảng theo snapshot hiện tại: `discardPile: [...(gameState.discardPile || []), ...cards]`.

### 23. Pending action bị treo (đặc biệt Rút Đáy)
- **Bug:** Hiện popup chờ NOPE, hết thời gian vẫn đứng và action không thực thi.
- **Root Cause:** Logic auto-resolve chỉ cho host xử lý khi timer về 0.
- **Fix:** Cho host **hoặc chính action owner** gọi `resolvePendingAction()` khi hết giờ.

### 24. Chồng action khi pending chưa xong
- **Bug:** Có thể đánh action/combo mới khi pending action cũ chưa resolve, dẫn đến popup sai loại lá (ví dụ đang combo 5 mà hiện Đâm Lén từ pending cũ).
- **Fix:** Trong `executePlay`, nếu đang có `pendingAction` thì chỉ cho phép reaction (`NOPE`/`CLONE` hợp lệ), chặn action mới.

### 25. NOPE chain đúng luật: owner được NOPE trả đũa
- **Rule chuẩn:** A đánh action → B NOPE → A có quyền NOPE lại (YUP) lá NOPE của B.
- **Fix logic:**
  - Chỉ chặn owner tự NOPE khi `nopeCount` đang chẵn (chưa ai NOPE trước).
  - Cho phép owner NOPE/CLONE phản đòn khi `nopeCount` lẻ.
  - Cập nhật điều kiện hiển thị nút phản ứng để khớp rule trên.

### 26. Đồng bộ thông điệp thời gian NOPE
- **Bug:** Log báo 5s trong khi countdown thực tế là 8s.
- **Fix:** Chuẩn hóa message NOPE window thành 8s.

### 27. Hỗ trợ test tạm thời: host luôn có 1 lá Lời Nguyền Mù
- **Mục đích:** Test nhanh chức năng Curse theo yêu cầu.
- **Cách làm:** Khi `startGame`, nếu host chưa có `CURSE_OF_THE_CAT_BUTT`:
  - Ưu tiên rút lá này từ deck (nếu có),
  - nếu không có thì tạo thêm 1 lá tạm cho host.
- **Lưu ý:** Đây là fix hỗ trợ test tạm thời, sẽ xóa sau khi test xong.

---

## Nguyên tắc chống hồi quy (Regression Rule)

- Khi sửa bug mới, **không được làm hỏng các bug đã fix trước đó**.
- Mọi thay đổi liên quan `pendingAction`, `defuse`, `discardPile`, `turnsToTake`, `isBlind` phải rà soát chéo các flow cũ trước khi merge.
- Ưu tiên thêm guard an toàn (early return + validate dữ liệu) thay vì sửa nóng làm đổi hành vi toàn cục.
