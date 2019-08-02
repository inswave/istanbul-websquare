
## Getting Started

Coverage 측정도구인 [istanbul](https://istanbul.js.org/)를 웹스퀘어에서 사용할 수 있도록 구성한 proxy 서버로 js, wq 파일을 자동으로 감지하여 coverage를 측정할 수 있는 소스를 삽입한다.
javascriptPluginAll.wq파일도 지원하지만 파일 크기가 커서 테스트 및 결과 조회에 시간이 많이 걸려서 js방식 또는 wq 파일 개별로딩 설정을 권장한다.
```xml
<engineLoadingMode ie="3" moz="3" opera="3" android="3" iphone="3" chrome="3" safari="3"/>
```

## 설치 및 환경 구성

* node, npm 설치 (node 8.9.3에서 테스트 완료)
* 소스 체크아웃
```shell
git clone https://github.com/inswave/istanbul-websquare.git
```
* node 모듈 설치
```shell
npm install
```
* config 수정 (websquare이 실행되고 있는 서버 주소를 serverUrl에 등록)
```JSON
{
    "verbose" : false,
    "serverUrl" : "http://localhost:8080",
    "listenPort" : 3100,
    "excludeFileList" : [],
    "includePath" : "",
    "excludePath" : [],
    "outputPath" : ""
}
```

## 테스트 실행
* 기존에 사용하던 테스트 서버의 주소를 localhost:3100 으로 변경하여 접속한다.
* 테스트가 완료되면 페이지를 닫기전에 ____uploadCoverage()를 호출하거나 WebSquare.logger.getErrorLog()를 호출하면 서버로 전송되어 메모리에 적재된다. (selenium 테스트 소스에서는 마지막에 WebSquare.logger.getErrorLog()가 호출되어 항상 저장된다.)

## 테스트 결과 조회
* [테스트 결과 조회 (http://localhost:3100/coverage)](http://localhost:3100/coverage)
* [테스트 결과 다운로드 (http://localhost:3100/coverage/download)](http://localhost:3100/coverage/download)

## 브라우저별 테스트 결과 조회
* [브라우저별 테스트 결과 조회 (http://localhost:3100/coverage/chrome)](http://localhost:3100/coverage/chrome)
  * chrome 외에 ie6, ie7, ie8, ie9, ie10, ie11, firefox, opera 등 브라우저값을 대신 넣어서 확인할 수 있다.
* [브라우저별 테스트 결과 다운로드 (http://localhost:3100/coverage/download/chrome)](http://localhost:3100/coverage/download/chrome)

## 백업, 복구
instanbul이 커버리지 측정도중에 계속 죽는 현상이 빈번하게 일어나서 다시 istanbul을 켯을 때 값들을 복구 할 수 있도록 백업과 복구 기능을 새로 추가했습니다.
* 백업
  * http://www.localhost:3100/coverage/backup
  * 브라우저 지정을 하지 않으면 전체 커버리지 백업을 시킨다. (backup 폴더에 저장)
  * http://www.localhost:3100/coverage/backup/chrome
  * backup 명령을 통해 강제로 바로 백업을 시킬 수 있으며 끝에 브라우저 지정을 해서 브라우저를 특정시켜야한다.
* 복구
  * http://www.localhost:3100/coverage/restore/ie11
  * restore 명령을 통해 바로 복구 할 수 있다.
  * 보통 istabul이 죽고나서 켜진 후에 바로 명령을 시행시켜주는 것이 좋다.
  * 브라우저 3개(chrome, firefox, ie11)를 기존에 커버리지 측정하고 있었다면, restore 뒤에 브라우저 값을 바꿔서 3개를 http-get으로 명령을 날려야된다.
  * http://www.localhost:3100/coverage/restore/chrome , http://www.localhost:3100/coverage/restore/firefox , http://www.localhost:3100/coverage/restore/ie11

## Release History

* 2018-02-08   v0.6.0   Initial release.
