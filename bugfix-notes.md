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

### 7. TARGETED_ATTACK log thiếu tên target
- **File:** `resolvePendingAction` case `TARGETED_ATTACK`
- **Fix:** Log message dạng: `🎯 ${me.name} đâm lén ${players[tIdx].name}! ${players[tIdx].name} cần rút thêm 2 lượt!`

### 8. ATTACK/TARGETED_ATTACK stacking không cộng dồn đúng
- **Bug:** Khi player A đang có 3 lượt và chơi ATTACK → next player chỉ nhận 3 lượt (1+2) thay vì 5 lượt (3+2)
- **Root Cause:** `players[nextIdx].turnsToTake += 2` cộng 2 vào `nextIdx.turnsToTake` (=1), không liên quan `me.turnsToTake`
- **Fix:** 
  - ATTACK: `const attackerTurnsToPass = me.turnsToTake; players[nextIdx].turnsToTake = attackerTurnsToPass + 2; me.turnsToTake = 1;`
  - TARGETED_ATTACK: `const attackerTurns = me.turnsToTake; me.turnsToTake = 1; players[tIdx].turnsToTake = attackerTurns + 2;`
- **Lưu ý:** Phải lưu `me.turnsToTake` vào biến tạm TRƯỚC khi reset `me.turnsToTake = 1`

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
- `defusingInterval` — ref để clearInterval; check null trước khi start

### Vị trí đặt bom (`completeDefuse`)
- `-2` = Đáy (`deck.unshift`)  
- `0`  = Trên cùng (`deck.push`)  
- `-1` = Ngẫu nhiên (`Math.random()`)  
- `n > 0` = Vị trí thứ n từ trên (`deck.splice(deck.length - n, 0, ...)`)

### turnsToTake logic
- Default = 1 (rút 1 lá, kết thúc lượt)
- ATTACK từ A → B: `B.turnsToTake = A.turnsToTake + 2`, rồi `A.turnsToTake = 1`
- Sau khi rút bài: `me.turnsToTake--; if (<=0) { reset=1; nextTurn }`
- SKIP: bỏ qua 1 lượt, giảm `turnsToTake` như rút bài
