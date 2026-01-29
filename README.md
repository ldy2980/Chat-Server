# 채팅 애플리케이션 백엔드

개요

실시간 채팅 기능을 제공하는 백엔드 시스템입니다. 확장성을 고려한 멀티 모듈 구조로 설계되었으며, RESTful API와 WebSocket을 통해 다양한 채팅 기능을 지원합니다. Docker Compose를 기반으로 전체 시스템을 손쉽게 배포하고 운영할 수 있습니다.

시스템 아키텍처

클라이언트의 요청은 Nginx 리버스 프록시를 통해 다수의 Spring Boot 애플리케이션 인스턴스로 분산됩니다. 각 애플리케이션은 PostgreSQL 데이터베이스와 Redis와 상호작용하여 비즈니스 로직을 처리합니다.

Client -> Nginx -> [Chat App 1, Chat App 2, ...] -> (PostgreSQL, Redis)

- Nginx: 모든 API 및 WebSocket 요청의 진입점 역할을 하며, 로드 밸런싱을 통해 트래픽을 여러 애플리케이션 서버로 분산시킵니다.
- Chat App 인스턴스: 실제 비즈니스 로직을 수행하는 Spring Boot 애플리케이션입니다. 수평 확장이 가능하여 높은 가용성과 처리량을 보장합니다.
- PostgreSQL: 사용자, 채팅방, 메시지와 같은 핵심 데이터를 영구적으로 저장하는 관계형 데이터베이스입니다.
- Redis: 실시간 메시지 전송을 위한 메시지 브로커(Pub/Sub) 및 고성능 데이터 캐싱 용도로 사용됩니다.

# 주요 기술 스택
- 언어: Kotlin
- 프레임워크: Spring Boot (Web, Data JPA, WebSocket)
- 빌드 도구: Gradle (Kotlin DSL)
- 데이터베이스: PostgreSQL
- 인메모리 데이터 저장소: Redis
- 배포 환경: Docker, Docker Compose
- 웹 서버: Nginx

# 모듈 구성
프로젝트는 기능적으로 분리된 여러 개의 Gradle 모듈로 구성되어 있습니다.

- chat-application: Spring Boot의 메인 진입점으로, 모든 모듈을 통합하고 애플리케이션을 실행합니다.
- chat-api: 채팅방 및 사용자 관리를 위한 RESTful API 엔드포인트를 제공합니다.
- chat-domain: 시스템의 핵심 로직, 도메인 모델(User, ChatRoom 등), 서비스 인터페이스를 정의합니다.
- chat-persistence: 데이터베이스 연동, 레포지토리, Redis 통합 등 데이터 영속성 관련 로직을 처리합니다.
- chat-websocket: WebSocket을 통한 실시간 메시지 송수신 및 관련 핸들러를 관리합니다.

# 서버 실행 및 접속
1. 사전 요구사항
    - Docker
    - Docker Compose

2. 서버 실행
    프로젝트 루트 디렉토리에서 아래 스크립트를 실행하여 모든 서비스를 빌드하고 시작합니다.
    ./start-cluster.sh

3. 접속 정보
    애플리케이션이 정상적으로 실행되면 다음 주소를 통해 접근할 수 있습니다.
    - API 엔드포인트: http://localhost/api
    - WebSocket 엔드포인트: ws://localhost/api/ws

# 주요 설정 파일
- Nginx 설정: nginx/nginx.conf
- Docker 서비스 구성: docker-compose.yml
- 데이터베이스 초기화 스크립트: init-db.sql
- 애플리케이션 Docker 환경 설정: chat-application/src/main/resources/application-docker.yml
