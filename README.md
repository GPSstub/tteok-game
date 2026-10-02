# 떡치기 연습 게임

토끼와 돼지 혼자 연습하는 웹게임입니다. 패턴마다 10초, 절구 6개, 최대 8줄 패턴을 지원합니다. 돼지 패턴은 다른 색과 보라가 한 세트로 나옵니다.

## GitHub Pages 배포

1. GitHub에서 새 저장소를 만듭니다. 무료 개인 계정에서는 Public 저장소를 사용합니다.
2. 이 압축파일을 풀고 index.html, pig.html, game.js, style.css, assets 폴더를 저장소의 최상위에 올립니다. 압축파일 자체를 올리지 마세요.
3. 저장소 Settings → Pages → Source에서 Deploy from a branch를 고릅니다.
4. Branch는 main, 폴더는 /(root)를 선택하고 Save를 누릅니다.
5. Pages에 표시되는 Visit site 링크를 엽니다.

게임 실행에는 ChatGPT 계정, API 키, 별도 서버 프로그램이 필요하지 않습니다. 토끼 화면에서 돼지로 전환할 수 있습니다. PC 입력키는 1, 2, 3, 4입니다.

## 로컬 실행

index.html을 브라우저에서 엽니다. 또는 이 폴더에서 python3 -m http.server 8000을 실행하고 http://localhost:8000을 엽니다.

## 파일

- index.html: 토끼 게임
- pig.html: 돼지 게임
- game.js: 공통 게임 규칙과 입력 처리
- style.css: 화면과 버튼 배치
- assets/: 사용자가 제공한 참고 화면에서 추출한 이미지

이미지는 참고한 원작의 요소를 포함합니다. 이 저장소는 이미지에 대한 별도 이용 허락을 부여하지 않습니다.
