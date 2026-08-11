# Tối ưu tốc độ quy trình E2E

**Ngày:** 2026-08-10
**Phạm vi:** `e2e/.claude/` — 2 command, 5 skill, 1 file reference

## Mục tiêu

| | Hiện tại | Mục tiêu |
|---|---|---|
| Lần đầu, task cỡ BR-52 | 50p / 150k token / mới xong 4/7 stage | **≤20p, xong cả 7 stage** |
| Chạy lại task đã có spec | không đo được (workers: 1) | **≤5p** |
| Số case, task cỡ BR-52 | 78 (lần 1) → 129 (lần 2) | **≤50 case, ≤25 browser test, ổn định giữa các lần** |

Giữ nguyên: độ phủ 100% AC, khả năng phát hiện lệch code-vs-doc (giá trị thật của BR-52v1: D1–D8 và B1–B7).

## Chẩn đoán

Nguyên nhân gốc là **số AC không có trần**. `e2e-analyze` bước 2 yêu cầu *"turning every branch, enum value and state worth checking into its own AC"*; `worth checking` là phán xét tự do, không giới hạn. BR-52v1 sinh 96 AC.

96 AC đó bị nhân lên qua **bốn** cơ chế cộng dồn:
1. `e2e-gen` §3 hard gate *"every AC needs at least one case"*
2. `field-validation.md`: mỗi input field = 1 positive + 2 negative
3. `e2e-gen` §5 completeness critic *"loop until two consecutive passes produce no new cases"* — dừng khi cạn, không dừng khi đủ
4. `quality-gate.md` A.4 *"Full dimensional coverage"* — lặp lại yêu cầu 1+2 mỗi field **và** "một case mỗi giá trị enum, mỗi page, mỗi runtime state", ngay trong gate duyệt plan

Cơ chế 4 được phát hiện muộn, khi viết implementation plan. Nó quan trọng vì nếu chỉ sửa `field-validation.md` (cơ chế 2) mà bỏ A.4 thì trần vẫn bị gate duyệt plan phá — hai file nói cùng một yêu cầu ở hai nơi.

Hệ quả đo được: `cases.yaml` 1803 dòng, `BR-52v1.spec.ts` 1122 dòng, 5 artifact prose tiếng Việt tổng **867 dòng** phải viết ra (analysis 243 · recon 145 · plan 202 · coverage 185 · data 92). Vì bước 2 là phán xét tự do, hai lần chạy cùng một ticket cho 78 và 129 case — chênh 65%. Đây không phải "đôi khi thừa" mà là **không xác định**.

Ba triệu chứng còn lại là hệ quả, cộng một lỗi độc lập:

- **recon ~20p**: `read_page` snapshot toàn trang cho mọi bước wizard, vì gen cần selector cho 68 test.
- **gen lâu**: một agent tuần tự viết 1122 dòng spec + 1803 dòng yaml, cộng loop-until-dry, cộng một independent subagent review.
- **pipeline tuần tự**: 4 repo diff đọc lần lượt.
- **`workers: 1` — lỗi độc lập, ảnh hưởng lớn nhất tới `run`.** `playwright.config.ts:29` đặt `workers: 4`, nhưng Playwright chỉ song song **ở mức file**; mỗi task chỉ có một spec file nên test trong file chạy tuần tự trừ khi một `describe` được đánh `mode: "parallel"`. `BR-52.spec.ts` và `BR-55.spec.ts` **không có block `describe` nào**, nên 4 workers thành vô nghĩa.

### Số liệu cứng từ `reports/*/report.json`

| Task | Tests | Workers thực | Browser suite | Có `describe` parallel? |
|---|---|---|---|---|
| BR-52 | 15 pass / 4 fail / 4 skip | 1 | 341s (5,7p) | không có describe nào |
| BR-52v1 | 40 pass / 7 fail / 21 skip | 4 | 318s (5,3p) | có, 4 group |
| BR-55 | 22 pass / 0 fail / 6 skip | 1 | 501s (8,4p) | không có describe nào |

BR-52v1 chạy 68 test nhanh hơn BR-55 chạy 28 test. Hướng dẫn chia group đã có trong `e2e-gen` §7 nhưng chỉ là lời khuyên, và 2/3 spec bỏ qua hoàn toàn.

21 test SKIPPED của BR-52v1 là do `phase: setup` chết trước khi tới chúng.

## Ngân sách phân bổ

analyze 3p · recon 3p · gen 5p · run 4p · flaky 2p · report 1p · dự phòng 2p = **20p**

## Thay đổi

### 1. Trần case theo risk

**`e2e-analyze` bước 2.** Bỏ cụm *"turning every branch, enum value and state worth checking into its own AC"*. Thay bằng hai quy tắc:

- AC phải là **hành vi quan sát được ở ranh giới hệ thống**, không phải nhánh code. Một nhánh code chỉ thành AC riêng khi nó tạo ra kết quả khác nhau mà tester nhìn thấy được; nếu không, nó gộp vào AC của hành vi bao ngoài.
- Mỗi AC gắn **risk ngay khi sinh ra**: High = tiền / quyền / mất dữ liệu · Medium = logic nghiệp vụ chính · Low = hiển thị phụ. Risk đi kèm AC suốt chain, không phải gán lại ở `e2e-gen`.

Vẫn giữ nguyên việc đọc code để tìm lệch code-vs-doc — thay đổi ở đây là **cách quy nhánh code thành AC**, không phải bỏ đọc code.

**`e2e-gen` §3 và §5.** Thay ba cơ chế nhân:

| Bỏ | Thay bằng |
|---|---|
| `e2e-gen` §3: every AC needs at least one case | AC High: mỗi AC ≥1 case. AC Medium: một case phủ nhiều AC. AC Low: một smoke case cho cả nhóm |
| `field-validation.md`: 1 positive + 2 negative cho mọi field | Chỉ áp cho field thuộc AC High. Field khác: 1 case biên đại diện, gộp nhiều field vào một case |
| `e2e-gen` §5: loop until two consecutive passes produce no new cases | Một vòng critic duy nhất, chỉ soát AC High và giá trị enum |
| `e2e-gen` §5: independent subagent review the plan | Bỏ hẳn |
| `quality-gate.md` A.4: một case mỗi giá trị enum / page / state, và 1+2 mỗi field | Độ phủ dimension **có trọng số theo risk**: mỗi giá trị enum phải xuất hiện đâu đó nhưng được gộp chung case khi không tương tác; page không áp dụng gộp thành một case âm; state chỉ tách khi đổi kết quả nghiệp vụ. Chỉ ô **High** bị bỏ mới cần ghi lý do |

Ngoài ra `quality-gate.md` A.1 liệt kê `coverage` trong danh sách artifact phải đồng bộ case id; bỏ nó khỏi danh sách vì `coverage.md` không còn tồn tại.

**Mục tiêu cỡ, không phải trần cứng:** ~50 case, trong đó ~25 browser test cho task lớn. Vượt nó là **tín hiệu soát lại xem có gì trùng**, không phải lệnh cắt cho đủ số.

Nguyên tắc chi phối: **bỏ case trùng và case vô nghĩa, không giảm số case cho đẹp.** Thứ tự cắt, dừng ngay khi về cỡ mục tiêu:

1. case trùng lặp — khác tên nhưng cùng đường code và cùng assert;
2. biến thể không đổi kết quả — cùng hành vi, giá trị khác, nhánh xử lý không đổi;
3. case gần như không xảy ra — tổ hợp người dùng thật không tạo được;
4. case thuần hiển thị — nhãn, thứ tự cột, chữ empty state → gộp thành một smoke;
5. biến thể field ở AC Medium và Low → gộp theo `field-validation.md`.

**Không bao giờ cắt**, kể cả khi vượt cỡ: case của một AC High; case âm cuối cùng còn lại của một hành vi; case ở biên của một phép tính; case chứng minh một điểm lệch code-vs-doc đã phát hiện.

Nếu làm hết năm bước mà vẫn vượt cỡ thì **cứ vượt**, kèm một dòng trong `plan.md` giải thích vì sao task này cần nhiều case hơn mức thường. Vượt cỡ có lý do là kết quả đúng; cắt một case High cho vừa con số là kết quả sai. Quy tắc cũ "every AC needs at least one case" sai vì nó **nhân đều**, không vì nó sinh nhiều case — nên thứ thay nó cũng phải phân biệt case đáng giữ với case thừa, chứ không chỉ đếm.

Sửa `references/field-validation.md` để nói rõ 1+2 chỉ áp cho field ở AC High.

### 2. Cắt artifact

- **`coverage.md`: bỏ.** Cột `AC` trong bảng case của `plan.md` cộng một dòng tổng kết độ phủ ở đầu file đã đủ làm gate. Hiện `coverage.md` 185 dòng phần lớn lặp lại thông tin đã có trong cột đó.
- **`data.md`: bỏ.** Thành cột `Dữ liệu` trong bảng case.
- **Stage `e2e-data`: bỏ.** Phần chọn giá trị dương/biên/âm chuyển vào `e2e-gen`. Mục 2 của `e2e-data` (query API tìm id/handle/email thật trên store) chuyển vào `e2e-recon`, vì recon đã mở trình duyệt trên đúng store đó. Xoá `e2e-data` khỏi bảng dispatch của `commands/e2e.md` và khỏi chuỗi trong `commands/e2e-full.md`.
- **`analysis.md`: chỉ còn 4 bảng** — AC+risk · AC→code · state→chain endpoint · assumption. Không prose diễn giải.
- **`recon.md`**: giữ nguyên hình dạng bảng hiện tại.

Ước lượng: 867 dòng artifact → ~300.

### 3. Song song hoá

- **`e2e-analyze` bước 3**: đọc diff của mọi repo trong `diffRepos` trong **một lượt tool call song song**, không lần lượt.
- **`e2e-recon`**: `read_page` chỉ một lần cho mỗi route mới để lấy cấu trúc; element sau đó tìm bằng `find` có mục tiêu. Cấm snapshot toàn trang lặp lại trên cùng một route.
- **`e2e-gen` §7**: sau khi plan được duyệt, chia spec theo `describe` group và **viết song song — mỗi group một subagent**. Các group vốn đã không dùng chung state theo định nghĩa của quy tắc parallel-safety, nên chia được an toàn.

### 4. Gate cứng cho parallel — chữa `workers: 1`

`e2e-gen` §7 chuyển từ lời khuyên thành **điều kiện không được vi phạm**: spec không được có `test()` nào nằm ngoài một `test.describe` có `configure({ mode: "parallel" | "serial" })` khai báo tường minh. Quy tắc phân nhóm giữ nguyên như hiện tại (read-only và dữ liệu namespaced → parallel; shop-wide setting, shared collection, store-wide total → serial).

Thêm vào `references/quality-gate.md` section B (definition of done cho spec) một dòng kiểm: mọi test thuộc một describe group có mode tường minh.

Đây cũng là thứ chữa luôn đường chạy lại ≤5p.

### 5. Trần cho flaky

`e2e-flaky` và `commands/e2e-full.md`: **5 vòng auto-heal → 2 vòng**. Mỗi vòng bắt buộc dùng `pnpm e2e:retry <slug> <case>`, không được chạy lại cả suite. Sau 2 vòng chưa xanh thì báo tester kèm những gì đã loại trừ, không tự chữa tiếp.

Bổ sung `e2e-run`: trước khi chạy, xác minh các `phase: setup` step thành công; setup chết là nguyên nhân của 21 SKIPPED ở BR-52v1 và phải được báo ngay chứ không lẫn vào kết quả cuối.

### 6. Đường chạy lại

Không thêm command mới. `/e2e run <slug>` đã đúng entry point; nó chậm chỉ vì spec không song song, và mục 4 chữa việc đó. Thêm một dòng vào `e2e-run` nói rõ: với spec đã có sẵn, đây là entry point cho regression, và `pnpm e2e:retry <slug>` khi chỉ muốn chạy lại phần fail.

## File bị sửa

| File | Thay đổi |
|---|---|
| `.claude/skills/e2e-analyze/SKILL.md` | bước 2 (AC là hành vi + risk), bước 3 (đọc diff song song), bước 7 (analysis.md 4 bảng) |
| `.claude/skills/e2e-gen/SKILL.md` | §3 §5 (trần theo risk, bỏ loop-until-dry và subagent review), §4 (cột Dữ liệu), §7 (gate parallel cứng, viết spec song song), bỏ coverage.md |
| `.claude/skills/e2e-recon/SKILL.md` | cấm snapshot lặp; tiếp nhận phần query dữ liệu thật từ e2e-data |
| `.claude/skills/e2e-run/SKILL.md` | xác minh setup; ghi rõ đường regression |
| `.claude/skills/e2e-flaky/SKILL.md` | 5 vòng → 2 vòng, buộc dùng e2e:retry |
| `.claude/skills/e2e-data/SKILL.md` | **xoá** |
| `.claude/skills/_shared/references/field-validation.md` | 1+2 chỉ áp cho AC High |
| `.claude/skills/_shared/references/quality-gate.md` | A.1 bỏ `coverage` khỏi danh sách artifact; **A.4 độ phủ dimension có trọng số theo risk**; B thêm dòng kiểm describe mode |
| `.claude/commands/e2e.md` | bỏ dòng dispatch `data` |
| `.claude/commands/e2e-full.md` | chuỗi 7 stage → 6, flaky 5 vòng → 2 |

Không sửa: `playwright.config.ts` (đã đúng), `src/*`, `e2e.config.yaml`, `automation-ladder.md`, `api-security.md`, `non-functional.md`, `flaky-taxonomy.md`, `conventions.md`, `project-notes.md`.

## Rủi ro và giới hạn

- **20p là ngân sách sát.** Phần dễ trượt nhất là `recon`: nó bị chặn bởi tốc độ thật của Shopify Admin nhúng iframe — `plan.md` của BR-52v1 tự ghi *"mỗi lần mở app trong Shopify Admin mất 15–25 giây"*. Task chạm 4 route như BR-52 khó xuống dưới 3p.
- **Cỡ ~50 case là con số phỏng đoán**, suy từ 129 case của BR-52v1 chứ không từ đo lường. Cần một lần chạy thật trên BR-52 để hiệu chỉnh.
- **Rủi ro lớn nhất của cả spec này là cắt quá tay.** Một quy tắc thu gọn diễn đạt bằng con số rất dễ bị thi hành thành "cắt cho đủ số", và mất một case High thì tệ hơn hẳn việc chain chạy 25 phút thay vì 20. Vì thế cỡ mục tiêu được viết là tín hiệu chứ không phải trần, kèm danh sách "không bao giờ cắt".
- **Chuẩn đúng là yêu cầu, không phải lần chạy trước.** Mục tiêu là tập case **chính xác**: không thiếu case cần có, cũng không thêm case thừa. Cả hai chiều đều đo bằng cách đối chiếu với ticket cộng code, **không** bằng cách so với BR-52 hay BR-52v1. Hai task đó chạy dưới quy trình cũ và cho 78 rồi 129 case trên cùng một ticket, nên ít nhất một trong hai đã sai — lấy chúng làm mốc đúng sẽ hợp thức hoá đúng những case thừa cần bỏ. Chúng chỉ là baseline **tốc độ**.
- **Gộp AC Medium làm case khó chẩn đoán hơn**: một case phủ nhiều AC thì khi fail phải xác định AC nào vỡ. Đổi lấy tốc độ; giảm nhẹ bằng việc cột `AC` của `plan.md` liệt kê đủ mọi AC mà case phủ.
- **Bỏ `coverage.md` làm mất bảng dimension→case** (giá trị enum, page, state). Cột `AC` không thay được hoàn toàn. Bù bằng dòng tổng kết độ phủ ở đầu `plan.md`: số AC phủ / tổng, số giá trị enum phủ, số case âm, ô bị bỏ có lý do.
- **Viết spec song song nhiều subagent** có thể sinh helper trùng nhau giữa các group. Cần một bước hợp nhất ngắn sau khi các group xong.

## Xác nhận sau khi sửa

Chạy `/e2e-full --jira BR-52` một lần trên slug mới (`BR-52v2`, giữ nguyên hai thư mục cũ) và đo tốc độ: tổng thời gian, thời gian từng stage, `stats.duration` và `config.workers` trong `report.json`, số dòng artifact. So với bảng số liệu ở trên.

Rồi kiểm **độ đúng của tập case**, đối chiếu với ticket cộng code chứ không với hai lần chạy cũ. Hai chiều:

- **Không thiếu** — mỗi AC High trong `analysis.md` tìm được ở cột `AC` của `plan.md`; mọi hành vi âm, mọi biên của phép tính, mọi điểm lệch code-vs-doc đều có case.
- **Không thừa** — mỗi case trỏ được tới một AC; không hai case nào cùng đường code và cùng assert; không case nào mô tả tình huống người dùng thật không tạo được.

Case nào còn do dự — chưa chắc thừa mà cũng chưa chắc cần — liệt kê ra cho tester quyết, đừng tự quyết.

**Chưa commit** cho tới khi tester chốt trên kết quả thật.
