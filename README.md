
## Getting Started

Coverage 측정도구인 [istanbul](https://istanbul.js.org/)를 웹스퀘어에서 사용할 수 있도록 구성한 proxy 서버로 js, wq 파일을 자동으로 감지하여 coverage를 측정할 수 있는 소스를 삽입한다.
javascriptPluginAll.wq파일도 지원하지만 파일 크기가 커서 테스트 및 결과 조회에 시간이 많이 걸려서 js방식 또는 wq 파일 개별로딩 설정을 권장한다.
'''xml
<engineLoadingMode ie="3" moz="3" opera="3" android="3" iphone="3" chrome="3" safari="3"/>
'''

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
  "listenPort" : 3100
}
```

## 테스트 실행
* 기존에 사용하던 테스트 서버의 주소를 localhost:3100 으로 변경하여 접속한다.
* 테스트가 완료되면 페이지를 닫기전에 ____uploadCoverage()를 호출하거나 WebSquare.logger.getErrorLog()를 호출하면 서버로 전송되어 메모리에 적재된다. (selenium 테스트 소스에서는 마지막에 WebSquare.logger.getErrorLog()가 호출되어 항상 저장된다.)

## 테스트 결과 조회
* [테스트 결과 조회](http://localhost:3100/coverage)
* [테스트 결과 다운로드](http://localhost:3100/coverage/download)

## Release History

* 2018-02-08   v0.6.0   Initial release.
