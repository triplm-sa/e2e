# e2e — Bộ khung kiểm thử E2E tự động, tích hợp AI

Sinh và thực thi test case từ Jira ticket bằng **Claude Code**, chạy trên **mọi target khai báo trong `e2e.config.yaml`** — `kind: api` (gọi HTTP trực tiếp) và `kind: browser` (Playwright). Ghi nhận lỗi console, xuất báo cáo kèm ảnh chụp và trace.

Ba đặc điểm cốt lõi:

- **Config-driven** — thêm/bớt tầng cần test chỉ là thêm/bớt khai báo target, không sửa mã nguồn.
- **Human-in-the-loop** — AI sinh kế hoạch kiểm thử đọc-được; tester phê duyệt trước khi biên dịch thành test.
- **Deterministic** — sau khi đã sinh, việc chạy lại là shell thuần (Node + Playwright), **không gọi AI**, nên kết quả tái lặp và không phát sinh chi phí token.

---

## Mục lục

- [Kiến trúc](#kiến-trúc)
- [Yêu cầu môi trường](#yêu-cầu-môi-trường)
- [Cài đặt & triển khai sang project khác](#cài-đặt--triển-khai-sang-project-khác)
- [Cấu hình](#cấu-hình)
- [Quy trình 7 bước](#quy-trình-7-bước)
- [Cấu trúc mỗi task](#cấu-trúc-mỗi-task)
- [Chạy thủ công](#chạy-thủ-công)
- [Định dạng test case](#định-dạng-test-case)
- [Checklist phương pháp](#checklist-phương-pháp)
- [Xử lý sự cố](#xử-lý-sự-cố)

---

## Kiến trúc

Hệ thống tách thành các lớp, trong đó **AI chỉ tham gia lớp sinh test**, còn lớp thực thi hoàn toàn độc lập:

| Lớp | Thành phần | Vai trò |
|---|---|---|
| Nguồn vào | Jira (MCP Atlassian) · source code + git diff · UI thật (Claude in Chrome) | Cung cấp yêu cầu và ngữ cảnh triển khai |
| **AI** | Claude Code + 7 skill trong `.claude/skills/` | Sinh kế hoạch, biên dịch test, phân tích lỗi |
| Tri thức | `_shared/` — quy ước & phương pháp (giữ nguyên) + **`project-notes.md`** (theo từng app) | Cho AI biết *cách làm* và *app này hoạt động ra sao* |
| Test & cấu hình | `plan.md`, `coverage.md`, `cases.yaml`, `*.spec.ts`, `e2e.config.yaml`, `.env` | Artifact tĩnh, versioned |
| **Engine** | `src/` — auth · api-runner · browser-fixture · report | Thực thi test, **không chứa AI** |
| Hệ thống đích | Target khai trong config | Môi trường thật |

Nhờ tách lớp: cùng một bộ test cho ra cùng kết quả, chạy lại bao nhiêu lần cũng được mà không cần AI; đổi app chỉ thay **`.env` + `project-notes.md`**, không sửa engine cũng không sửa phương pháp.

### Mã nguồn engine (`src/`)

| File | Trách nhiệm |
|---|---|
| `config.ts` | Đọc + validate `e2e.config.yaml`, nội suy `${VAR}` từ `.env`/`process.env` |
| `env.ts` | Parser `.env` dùng chung (bỏ inline comment, giữ nguyên giá trị trong nháy) |
| `auth/index.ts` | Sinh header xác thực theo `auth.type` của target |
| `auth/session-jwt.ts` | Tự ký Shopify App Bridge session token (HS256) |
| `api-runner.ts` | Chạy API step, nội suy `${var}`, `capture` giá trị cho step sau |
| `browser-fixture.ts` | Fixture Playwright: mở target theo config, bắt console error, chụp ảnh trang thật |
| `run.ts` | Điều phối API step tuần tự, giữ biến chain, ghi report |
| `report.ts` | Render `report.md` và `report.csv` (deterministic, không cần AI) |
| `doctor.ts` | Preflight: Chrome, config, chữ ký token, phiên đăng nhập, tình trạng API |
| `all.ts` | Chạy trọn doctor → API → browser cho một hoặc nhiều task |
| `login.ts` | Lưu phiên đăng nhập (chrome-profile hoặc storage-state) |

Unit test của chính engine nằm ở `tests/` — chạy bằng `pnpm test`.

---

## Yêu cầu môi trường

- **Node** ≥ 20 và **pnpm** ≥ 9.
- **Google Chrome** đã cài trên máy — target browser chạy `channel: chrome` (không dùng Chromium bundled) để xử lý Cloudflare và 2FA của Shopify.
- **Claude Code** nếu dùng các lệnh `/e2e` (sinh test, phân tích). Không cần cho việc chạy lại test.
- **MCP Atlassian** nếu lấy requirement từ Jira; **Claude in Chrome** nếu dùng stage `recon`.

---

## Cài đặt & triển khai sang project khác

Skill và slash command đặt ngay trong thư mục này (`.claude/`, dạng *directory-scoped*), nên sao chép toàn bộ `e2e/` sang project khác là mang theo đầy đủ bộ công cụ.

```bash
cd e2e
pnpm install                  # 1. cài dependencies
cp .env.example .env          # 2. điền biến cấu hình cho app mới
#                               3. xoá nội dung project-notes.md của app cũ (giữ tiêu đề)
pnpm e2e:doctor               # 4. kiểm tra môi trường, báo pass/fail từng mục
pnpm e2e:login cms            # 5. lưu phiên đăng nhập (nếu test target browser)
```

Không cần sửa mã nguồn hay `e2e.config.yaml` — giá trị theo app nằm trong `.env`, tri thức về app nằm trong `project-notes.md`.

### Phân tầng tri thức

| Tầng | Ở đâu | Khi đổi app |
|---|---|---|
| **Nền tảng Shopify** — Admin deep link, app nhúng iframe, console noise của storefront, 2FA | `_shared/conventions.md` | giữ nguyên |
| **Phương pháp** — thang tự động hoá, quality gate, phân loại lỗi, checklist trường | `_shared/references/` | giữ nguyên |
| **Tri thức về app cụ thể** — target nào, chuỗi endpoint đạt trạng thái, setting đổi được ở đâu, health check | `_shared/project-notes.md` | **xoá nội dung cũ** |

### `project-notes.md` — tài liệu sống, tự đầy dần

**Không phải viết sẵn trước khi chạy.** File có thể để trống hoàn toàn: khi thiếu thông tin, skill tự đi tìm trong mã nguồn rồi **ghi bổ sung những gì phát hiện được**. Chạy càng nhiều task, file càng giàu, và các task sau khởi đầu từ bản đồ tốt hơn.

Bốn mục, giữ nguyên tiêu đề dù chưa có nội dung:

| Mục | Nội dung | Ai bổ sung |
|---|---|---|
| **Targets** | Target nào tồn tại, target nào nhúng trong Admin | người (hoặc suy từ config) |
| **Known state chains** | Chuỗi endpoint đạt từng trạng thái (`create-…` → `complete-…`) | `analyze`, `data` tự ghi |
| **Switchable settings** | Setting đổi được bằng endpoint nào, kèm cạm bẫy | `analyze` tự ghi |
| **Environment checks** | URL health check | người |

> ⚠️ Khi đổi sang app khác, **xoá nội dung cũ đi**. Để nguyên endpoint của app trước còn tệ hơn để trống — skill sẽ tin và đi tìm route không tồn tại.

**Secret** (`SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET_KEY`) resolve theo ba nguồn ưu tiên, chỉ cần một trong ba:

1. `process.env` — phù hợp CI.
2. `e2e/.env` — bộ khung tự chứa.
3. File trỏ bởi `API_ENV_FILE` — dùng chung `.env` của app (mặc định).

---

## Cấu hình

### `e2e.config.yaml`

File này là **template**: mọi giá trị theo project đọc từ `.env` qua `${VAR}` (hỗ trợ `${VAR:-default}`). Mỗi `target` gồm `kind` (`api`|`browser`), `baseUrl` và `auth`.

| `auth.type` | Dùng cho | Tham số |
|---|---|---|
| `shopify-session-jwt` | API Shopify app — tự ký session token | `apiKeyVar`, `apiSecretVar`, `shopDomain`, `headerPrefix?`, `envFile?` |
| `chrome-profile` | Browser — đăng nhập một lần (kể cả 2FA), tái sử dụng phiên | `profileDir`, `loginUrl?` |
| `storage-state` | Browser — đăng nhập thủ công, lưu file JSON | `file` |
| `bearer-env` | API dùng token trong env | `tokenVar`, `envFile?` |
| `none` | Endpoint công khai | — |

Khai bao nhiêu target tùy dự án: monolith vài target là đủ, microservices thì khai một target `api` cho mỗi service.

### Biến trong `.env`

| Biến | Ý nghĩa | Ví dụ |
|---|---|---|
| `JIRA_PROJECT_KEY` | Prefix ticket của project | `BR` |
| `DIFF_REPOS` | Repo app (tương đối từ `e2e/`) để đọc diff branch; để trống nếu không có | `../App-api, ../App-cms` |
| `BASE_BRANCH` | Branch gốc để so diff | `master` |
| `STORE` | Phần trước `.myshopify.com` | `my-store` |
| `APP_HANDLE` | Handle app trong Shopify Admin | `b2bridge-app` |
| `APP_DOMAIN` | Host domain app, khớp `src` iframe | `app.example.com` |
| `API_BASE_URL` | URL API của app | `https://app-api.example.com` |
| `API_ENV_FILE` | `.env` của app chứa key/secret; để trống nếu dùng cách 1 hoặc 2 | `../App-api/.env` |
| `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET_KEY` | Secret ký session-JWT | — |

Cần biến riêng cho project? Thêm vào `.env` rồi tham chiếu `${VAR}` trong config.

### CMS = app nhúng trong Shopify Admin

Target `cms` **không** trỏ tới domain riêng của app — làm vậy sẽ bỏ qua phiên Shopify và App Bridge. `baseUrl` là deep link Admin:

```yaml
cms:
  kind: browser
  baseUrl: https://admin.shopify.com/store/${STORE}/apps/${APP_HANDLE}
  appIframeSrc: ${APP_DOMAIN}     # host iframe chứa UI app
  auth:
    type: chrome-profile
    profileDir: .auth/cms-profile
    loginUrl: https://admin.shopify.com/store/${STORE}
```

Test đi đúng luồng **Admin → app (iframe) → route**; route tương đối được ghép vào `baseUrl` đầy đủ. UI app nằm trong iframe nên spec thao tác qua `page.frameLocator('iframe[src*="<appIframeSrc>"]')`.

---

## Quy trình 7 bước

`analyze → recon → gen → data → run → flaky → report`. Mỗi stage là **một skill độc lập**, gọi lẻ được; stage sau đọc kết quả stage trước.

| Lệnh | Skill | Kết quả |
|---|---|---|
| `/e2e analyze [--jira KEY]` | `e2e-analyze` | Tách acceptance criteria đánh số, phát hiện điểm mập mờ, xác nhận với tester → `analysis.md` |
| `/e2e recon <slug>` | `e2e-recon` | Dùng Claude in Chrome soi DOM thật (iframe/shadow/SPA), thu thập selector + data thật → `recon.md` |
| `/e2e gen [--jira KEY] [--design f.html]` | `e2e-gen` | Requirement + diff + codebase → `plan.md` (cột AC và Rủi ro) + `coverage.md` → **tester phê duyệt** → biên dịch `cases.yaml` + spec |
| `/e2e data <slug>` | `e2e-data` | Data thật trên store hoặc data sinh mới (unique/biên/pairwise) → `data.md` |
| `/e2e run <slug>` | `e2e-run` | Thực thi API + browser, phân tích nguyên nhân trỏ `file:line` → `reports/<slug>/report.md` |
| `/e2e flaky <slug> [fix]` | `e2e-flaky` | Chạy lại, phân loại 4 nhóm nguyên nhân, auto-heal tối đa 5 vòng, tin pass ≥2 lần liên tiếp |
| `/e2e report <slug>` | `e2e-report` | Viết phần phân tích vào `report.md` (`report.csv` do engine sinh sẵn) |
| `/e2e login [target=cms]` | — | `pnpm e2e:login`: mở Chrome → đăng nhập Shopify + 2FA → mở app → đóng cửa sổ, phiên lưu vào profile |

**Chạy toàn bộ chuỗi bằng một lệnh:** `/e2e-full --jira <KEY>` — orchestrator kết hợp mọi skill, ghi tiến độ vào `cases/<slug>/task.md`.

Quy trình chỉ dừng để hỏi tester ở **hai điểm kiểm soát**: (1) phê duyệt kế hoạch sau `gen`; (2) khi phát hiện mâu thuẫn quy tắc nghiệp vụ. Ngoài ra AI tự chạy.

---

## Cấu trúc mỗi task

Đầu vào (`cases/`) tách riêng đầu ra (`reports/`):

```
cases/<slug>/                # ĐẦU VÀO (vd BR-53/)
  analysis.md                # acceptance criteria + điểm mập mờ        (analyze)
  recon.md                   # selector & dữ liệu thật                  (recon)
  plan.md                    # kế hoạch đọc-được — TESTER PHÊ DUYỆT     (gen)
  coverage.md                # ma trận AC → case                        (gen)
  data.md                    # dữ liệu test                             (data)
  cases.yaml                 # test tầng API (máy chạy)                 (gen)
  browser/<slug>.spec.ts     # test giao diện (máy chạy)                (gen)
  task.md                    # tiến độ full-flow                        (e2e-full)

reports/<slug>/              # ĐẦU RA (gitignore, ghi đè mỗi lần chạy)
  report.md                  # 1. Bug · 2. Kết quả theo case · 3. Case chưa kiểm được · 4. Console
  report.csv                 # engine tự sinh mỗi lần chạy — Google Sheets / Jira / TestRail
  report.json                # dữ liệu máy đọc
  html/index.html            # báo cáo Playwright, ảnh nhúng sẵn
  artifacts/<test>/          # ảnh chụp mỗi case + trace.zip khi FAIL
```

Xem kết quả browser: mở `reports/<slug>/html/index.html`. Mở trace: `pnpm exec playwright show-trace <file.zip>`.

Ba đầu ra cuối cùng của một task: **kết luận chất lượng** (`report.md`), **bằng chứng** (ảnh + trace), và **tài sản tái dùng** — bộ test regression chạy lại bằng `pnpm e2e:all`.

### `report.md` viết cho tester, không phải nhật ký công việc

Engine sinh sẵn khung 4 mục; AI chỉ điền **mục 1 — Bug**:

| Mục | Nội dung | Ai viết |
|---|---|---|
| 1. Bug | Mỗi bug một khối: hiện tượng · kỳ vọng (theo AC) · **các bước tái hiện thủ công** · bằng chứng · nghi ngờ `file:line` · trạng thái (🔴 mới / 🟢 đã fix, verify lại / 🟠 còn lặp lại) | AI |
| 2. Kết quả theo case | Bảng pass / fail / skip kèm phase và risk | engine |
| 3. Case chưa kiểm được | Case bị skip + lý do | engine |
| 4. Console đáng chú ý | Chỉ message **không** gắn nhãn `NOISE` | engine |

**Không đưa vào report**: những gì AI đã tự động hoá thêm, số bản ghi đã tạo qua API, sự cố khi chạy lại, lỗi spec tự sửa dọc đường, case nào chưa tự động hoá được. Đó là nhật ký công việc, không phải kết quả kiểm thử — độ bao phủ thuộc `plan.md`, dữ liệu thuộc `data.md`, chuỗi endpoint thuộc `project-notes.md`.

---

## Chạy thủ công

Không cần Claude Code, không tốn token:

```bash
# Một lệnh: doctor → API → browser, cho một hoặc nhiều task
pnpm e2e:all <slug>
pnpm e2e:all BR-55 BR-53

# Hoặc từng phần
pnpm e2e:doctor
pnpm e2e:run cases/<slug>/cases.yaml
E2E_OUTDIR=reports/<slug> pnpm e2e:browser cases/<slug>/browser/<slug>.spec.ts

# Unit test của chính engine
pnpm test
```

`e2e:all` tự set `E2E_OUTDIR=reports/<slug>`, bỏ qua phần không có (task chỉ có API thì bỏ browser), và ghi đè `reports/<slug>/`.

Biến môi trường hữu ích:

| Biến | Tác dụng |
|---|---|
| `E2E_CONFIG` | Đường dẫn `e2e.config.yaml` khi chạy từ ngoài thư mục `e2e/` |
| `E2E_OUTDIR` | Thư mục đầu ra cho lần chạy browser |
| `E2E_HEADLESS=1` | Chạy browser ẩn (mặc định hiện cửa sổ để giảm rủi ro bị Cloudflare chặn) |

---

## Định dạng test case

```yaml
id: br-53-approve
feature: Duyệt đăng ký & thêm vào Company Account
targets: [api, cms]
steps:
  - target: api
    case: BR-A1
    action: Duyệt & gán công ty qua API (hợp lệ)
    request: { method: POST, path: /registrations/1/approve, body: { companyId: 1, roleId: 2 } }
    expect: { status: 200, bodyMatch: { "data.status": "approved" } }
```

- **API step**: `request{method, path, headers?, body?}` + `expect{status?, bodyMatch?}`. `bodyMatch` dùng dot-path.
- **`risk`** (tùy chọn, `High`/`Medium`/`Low`): mang mức rủi ro từ `plan.md` sang, hiển thị trong `report.md` và cột Risk của `report.csv`.
- **Browser step**: `case`, `action` (mô tả) và `spec` — Claude sinh file `.ts` dùng fixture `src/browser-fixture.ts`.

### Tiền đề & dọn dẹp — `phase: setup | test | teardown`

Khi test cần dữ liệu chưa có (đơn hàng, thành viên, tài khoản…), **tạo bằng setup step thay vì nhờ người chuẩn bị tay**:

```yaml
steps:
  - target: api
    case: SETUP-01
    phase: setup                       # chạy trước, tạo tiền đề
    action: Tạo đơn hàng cho company test
    request: { method: POST, path: /orders/create-draft-order, body: { ... } }
    expect: { status: 200 }
    capture: { draftId: data.draftOrder.id }

  - target: api
    case: TD-13                        # phase mặc định = test
    request: { method: GET, path: "/reports/outstanding?order=${draftId}" }
    expect: { status: 200 }

  - target: api
    case: TEARDOWN-01
    phase: teardown                    # luôn chạy, kể cả khi đã abort
    request: { method: POST, path: /orders/delete-draft-order, body: { id: "${draftId}" } }
    expect: { status: 200 }
```

| Phase | Hành vi |
|---|---|
| `setup` | Chạy trước. **Fail → dừng**, các `test` còn lại báo **SKIPPED** (không phải FAILED, vì chúng chưa từng có tiền đề hợp lệ) |
| `test` | Mặc định. **Chỉ phase này tính vào điểm** pass/fail |
| `teardown` | Luôn chạy, kể cả sau khi abort — dọn dữ liệu setup đã tạo |

Bản ghi **không xoá được** (vd order trong Shopify) → nên **seed một lần rồi assert read-only**, thay vì tạo mới mỗi lần chạy.

Quy tắc quyết định case nào tự động được: `.claude/skills/_shared/references/automation-ladder.md`.

### Chain luồng nghiệp vụ bằng API

Các API step chạy **tuần tự**; `capture` lưu giá trị từ response cho step sau qua `${var}`. Nhờ đó kiểm thử được state-machine nghiệp vụ đầu-cuối mà **không cần đăng nhập trình duyệt** — phù hợp cả kiến trúc microservices (token do service A cấp, dùng ở service B).

```yaml
steps:
  - target: api
    case: FLOW-01
    request: { method: POST, path: /company-accounts/1/members, body: { email: "x@test.com", role_id: 2 } }
    expect: { status: 200 }
    capture: { token: data.member.invite_token }
  - target: api
    case: FLOW-02
    request:
      method: POST
      path: /company-members/approve-invite
      body: { token: "${token}" }
    expect: { status: 200 }
```

- `"${var}"` khớp toàn bộ chuỗi → **giữ nguyên kiểu** (số/bool/object); `"u-${var}"` nội suy giữa chuỗi → chuyển thành text.
- Giá trị chứa `${...}` **bắt buộc đặt trong nháy** (vd `path: "/x/${id}/y"`) — YAML coi `{` là flow-map nếu không quote.
- Capture path không tồn tại trong response → step FAIL kèm chú thích, tránh chain sai mà không báo.

---

## Checklist phương pháp

Các stage tự tham chiếu những tài liệu trong `.claude/skills/_shared/`. Phân tầng: **giữ nguyên** khi đổi app, trừ `project-notes.md`.

| File | Nội dung | Đổi app |
|---|---|---|
| `conventions.md` | Quy ước chung: triết lý test, quy tắc bằng chứng, app nhúng Admin/iframe, quy tắc viết spec, quy ước ngôn ngữ | giữ |
| `references/automation-ladder.md` | Thang 5 bậc quyết định case nào tự động được; quy tắc "đi hết chuỗi"; setting là setup step | giữ |
| `references/quality-gate.md` | Self-quality-gate cho plan + definition-of-done cho spec + cấm `waitForTimeout` + ưu tiên locator | giữ |
| `references/field-validation.md` | 15 loại trường; mỗi trường ≥1 positive + ≥2 negative/biên | giữ |
| `references/api-security.md` | HTTP status cần phủ + OWASP API (BOLA/IDOR cross-shop, mass assignment, rate limit, data leak) | giữ |
| `references/non-functional.md` | Race/double-submit, session & network, localization, a11y, phân quyền hiển thị | giữ |
| `references/flaky-taxonomy.md` | Phân loại fail theo nhóm locator / timing / data / feature | giữ |
| **`project-notes.md`** | **Tri thức về app cụ thể**: targets, chuỗi endpoint đạt trạng thái, setting đổi được, health check | **viết lại** |

Ba cơ chế chống bỏ sót:

1. **Acceptance criteria** — mỗi AC phải có ≥1 case, ghi trong `coverage.md`; `gen` lặp completeness critic tới khi hai vòng liên tiếp không sinh case mới.
2. **Thang tự động hoá** — case chỉ được đánh manual sau khi trượt cả 5 bậc, và phải ghi luận cứ từng bậc kèm tên router đã soi. Tiền đề là *entity*, *setting cần đổi* hay *identity cần đăng nhập* đều tự động được.
3. **Quy tắc bằng chứng** — console là tín hiệu yếu; message gắn nhãn `NOISE` (extension, third-party) không phải bằng chứng về app. Muốn kết luận hạ tầng lỗi phải chạy kiểm trực tiếp và trích output.

---

## Xử lý sự cố

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| Test bị đá về trang đăng nhập; ảnh chụp trắng | Phiên hết hạn → `pnpm e2e:login <target>` |
| `[NEEDS-SELECTOR-REVIEW]` fail | Vấn đề selector hoặc môi trường, **không phải** lỗi feature → `/e2e recon <slug>` để lấy selector thật |
| Không thấy element trong app nhúng | Phải truy cập qua `frameLocator`, không dùng `page` ngoài |
| `bad port` khi gọi API | Node `fetch` chặn một số port (vd 6000) → đổi sang port khác hoặc dùng `curl` |
| Config lỗi `undefined variable` | Biến `${VAR}` chưa khai trong `.env` → thêm vào, hoặc dùng `${VAR:-default}` |
| Profile Chrome bị khóa | Playwright chạy `workers: 1`; đóng cửa sổ Chrome đang dùng chung profile đó |
| Test chập chờn | `/e2e flaky <slug>` — phân loại nguyên nhân, chỉ tin khi pass ≥2 lần liên tiếp |
| Case bị đánh "cần chuẩn bị thủ công" trong khi API tạo được dữ liệu | `project-notes.md` chưa có chuỗi endpoint tương ứng → bổ sung vào mục *Known state chains*, rồi `/e2e gen` lại. Thang tự động hoá bắt buộc ghi luận cứ từng bậc trước khi được đánh manual |
| AI kết luận "tunnel/API chết" mà dịch vụ vẫn sống | Đã suy diễn từ console. Message gắn nhãn `NOISE` (extension, third-party) không phải bằng chứng — yêu cầu chạy `pnpm e2e:doctor` hoặc `curl` và trích output |
