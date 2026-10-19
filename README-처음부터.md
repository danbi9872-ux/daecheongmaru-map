# 대구고용노동청 대청마루 기업지도: 처음부터 설치하기

이 폴더의 `public`, `functions`, `supabase-setup.sql`을 GitHub 저장소의 **최상위**에 올립니다. ZIP 파일 자체를 저장소에 올리면 Cloudflare Pages가 내부 파일을 배포하지 못합니다.

## 1. 기존 GitHub 저장소 정리

현재 저장소에 올라간 예전 ZIP에는 사업자등록번호가 포함된 파일이 있습니다. GitHub 저장소를 먼저 **Private**으로 전환하세요: 저장소 → Settings → General → Danger Zone → Change repository visibility. 그런 다음 기존 ZIP을 삭제하고 이 패키지의 압축을 풀어 내용물을 올리세요. 일반적인 삭제 커밋으로는 이전 Git 기록에 있던 파일이 사라지지 않습니다. 공개용으로 다시 만들려면 기록을 별도로 정리하거나 새 저장소를 만들어야 합니다.

## 2. Supabase 데이터베이스 설정

1. Supabase 대시보드에서 현재 프로젝트를 엽니다.
2. 왼쪽 **SQL Editor** → **New query**에 `supabase-setup.sql` 전체를 붙여넣고 **Run**을 한 번 누릅니다. `map_companies`, `map_admins`, `company-briefs`가 만들어집니다.
3. **Authentication → Users → Add user**에서 관리자 이메일과 강력한 비밀번호를 설정합니다. 확인 메일을 요구한다면 관리자 계정의 이메일 확인 상태도 완료합니다. 공개 회원가입은 Authentication 설정에서 사용하지 않도록 관리하세요.
4. SQL Editor에서 아래 SQL의 이메일을 실제 관리자 이메일로 바꾸어 실행합니다.

```sql
insert into public.map_admins(user_id)
select id from auth.users where email = '관리자이메일@example.com'
on conflict do nothing;
```

`NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에 해당하는 공개 설정은 이미 `public/supabase-config.js`에 넣었습니다. **service_role 키, 비밀번호, 고용24 인증키는 GitHub 파일에 넣지 마세요.** Supabase의 공개 키가 노출되어도 수정 권한은 데이터베이스의 RLS 정책으로 제한됩니다.

## 3. GitHub에 파일 올리기

1. 이 ZIP의 압축을 풉니다.
2. GitHub 저장소 `danbi9872-ux/daecheongmaru-map`에서 **Add file → Upload files**를 누릅니다.
3. 압축을 푼 `public` 폴더와 `functions` 폴더, `supabase-setup.sql`, 이 README를 끌어다 놓고 **Commit changes**를 누릅니다. 폴더 구조가 `public/index.html`, `public/admin.html`, `functions/api/work24-jobs.js`로 보이는지 확인합니다. 파일을 하나씩 올려도 됩니다.
4. 기존 ZIP 파일은 저장소의 파일 목록에서 삭제합니다. 1단계의 기록 관련 설명도 확인하세요.

## 4. Cloudflare Pages 프로젝트 생성

1. Cloudflare 대시보드 → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. GitHub 계정을 연결하고 위 저장소를 선택합니다. 저장소를 Private으로 바꿔도 GitHub 앱에 접근 권한을 주면 연결할 수 있습니다.
3. 프로젝트 이름을 정합니다(예: `daecheongmaru-map`). **Production branch**는 GitHub의 기본 브랜치(`main` 등)를 선택합니다.
4. Framework preset은 **None**, Build command는 **비움**, Build output directory는 **`public`**, Root directory는 저장소의 **최상위**로 설정하고 배포합니다.
5. 고용24 채용정보 기능을 쓰려면 Pages 프로젝트의 **Settings → Variables and Secrets**에서 `WORK24_API_KEY`를 **Secret**으로 추가하고 재배포합니다. 기존 승인받은 고용24 인증키를 입력합니다. 인증키가 없어도 기업지도와 관리자 기능은 동작하지만 채용정보 실시간 조회는 대기 메시지를 보여줍니다.

## 5. 작동 확인

- 배포 주소에서 기업지도가 표시되는지 확인합니다.
- `배포주소/admin.html`에서 등록한 관리자 이메일과 비밀번호로 로그인하고 기업정보를 저장한 뒤 공개 지도를 새로고침합니다.
- PNG/PDF 업로드를 시험합니다. 파일당 최대 10 MB입니다. PNG는 안내문 화면에 직접 표시됩니다.
- 고용24 인증키를 등록했다면 기업의 채용정보 조회도 확인합니다.

기존 Netlify 주소가 새 주소로 자동 변경되지는 않습니다. 새 Cloudflare 주소가 정해지면 구글·네이버 웹마스터 도구에 새 주소를 등록하고, 필요한 경우 기존 사이트에서 새 사이트로 연결하세요. 새 주소가 정해지기 전에는 옛 Netlify 주소를 가리키는 canonical/sitemap을 이 패키지에서 제거했습니다.

## 폴더 안내

- `public/index.html`: 공개 기업지도와 기본 기업 데이터 1,126곳
- `public/admin.html`: 관리자 화면
- `public/supabase-config.js`: 공개 Supabase 프로젝트 연결값
- `public/briefs/`: 기존 기업안내문 샘플
- `functions/api/work24-jobs.js`: 서버에서 고용24 인증키로 채용정보 확인
- `functions/api/companies.json`: 채용정보 매칭용 기업명·주소 데이터; 사업자등록번호 없음
- `supabase-setup.sql`: 관리자 권한 및 업로드 정책

새로 등록한 기업/수정 내용/안내문은 Supabase에 저장되므로 이후 지도 HTML을 새로 배포해도 유지됩니다. 단, Supabase 프로젝트를 삭제하면 이 데이터도 사라집니다.
